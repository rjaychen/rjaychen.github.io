---
date: "2026-09-07"
layout: post
title: "Khepri Devlog #1: The Basics of a Vulkan Graphics Engine"
subtitle: "Building a sandbox for procedural animation, particle physics, and modern rendering"
description: "First devlog on Khepri: building a modern Vulkan graphics engine, procedural geometry graph, and editor foundation for real-time animation and particle physics."
image: /img/mpm-lite-banner.jpg
optimized_image: /img/mpm-lite-banner.jpg
category: graphics
tags:
 - blog
 - graphics
 - vulkan
 - cpp
 - engine
 - physics
 - animation
author: rjaychen
paginate: false
---

## Motivation

It's been a bit since my last post on Vision Pro research, but since my undergrad research, I've always wanted to make my own graphics and physics sandbox from scratch in C++20/23 with a modern graphics interface (Vulkan). And so, without further ado, I announce the very unfinished **Khepri**.


Most of my work up to this point in computer graphics has been self-discovery via exploration, without much guidance. For example, my AVP project -- writing Metal shaders for visionOS, hacking together custom spatial mesh pipelines for Diminished Reality on the Apple Vision Pro, or working with Unity and RealityKit. Or, in uni, where I learned from the great Mike Reed how to build 2D graphics (stroking, tesselation, render passes) from the foundational Skia library.

This time, I decided to start from nothing and architect the engine, making specific design choices and discovering the many pain points that any developer that ends up wanting to make their own game engine encounters (for example, implementing something you might think is rudimentary from the start, like an undo/redo mechanism, can pay it forward like in Tim Robinson's sketch).

My hope for Khepri Graphics is to unify three things: **procedural animation**, **high-density particle physics**, and an **advanced rendering**, with a huge emphasis on **ease-of-use**. 

I've always found that game, graphics, and animation engines have massive learning curves that affect barriers to entry for creators. Either, they might be lacking in necessary features that allow for more advanced users to be satisfied, or they're massively bloated frontends where finding simple tools takes ten menus and a decade of experience. I wanted a simple, clean creative environment, where controls felt intuitive, but you could also push boundaries.

Here's a quick demo video of where the engine and editor currently stand:

<iframe width="100%" height="450" src="https://drive.google.com/file/d/1GEO133P8uj3tZurs8MW_eYp4byGA42R7/preview" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

*(If the inline player doesn't load in your browser, you can also [watch the video directly on Google Drive](https://drive.google.com/file/d/1GEO133P8uj3tZurs8MW_eYp4byGA42R7/view?usp=sharing).)*

---

## Inspiration: MPM-Lite at SIGGRAPH 2026

A huge spark of inspiration for the physics side of Khepri came from the recent SIGGRAPH 2026 paper: [_MPM Lite: Linear Kernels and Integration without Particles_](https://mpmlite.github.io/) by Feng et al.

![MPM Lite Teaser](/img/mpm-lite-banner.jpg)

If you've ever dealt with Material Point Method (MPM) simulations, you know how computationally demanding and delicate particle-grid transfers can be, especially when trying to model elastoplastic behaviors like sand, snow, or mud in real time. Traditional MPM relies heavily on particle-based quadrature at solve time, which quickly becomes a massive performance bottleneck.

MPM-Lite rethinks this by adopting linear kernels and eliminating particle-based quadrature during integration, showing up to a **15.9× speedup** over implicit MPM while retaining the robustness of continuum mechanics. 

Seeing their results simulating swirling sand and flowing granular materials was a huge lightbulb moment for me. My long-term goal for Khepri is to integrate an MPM-Lite inspired solver into the compute pipeline so that continuum particle simulations can seamlessly interact with procedural meshes right inside the viewport.

---

## Laying the Vulkan Foundations

Vulkan is a pain to learn as a newer dev to the graphics scene, but I already had some OpenGL and Metal experience, and had knowledge of the terms being thrown around in tutorials. I found [OGLDev's](https://ogldev.org/index.html) YouTube series particularly useful for this matter (shoutout to him!). 

For my purposes, I organized the Vulkan backend around a few focused abstractions:

- **Volk & VMA:** Instead of linking statically against the Vulkan loader, I used [Volk](https://github.com/zeux/volk) for dynamic function loading and [Vulkan Memory Allocator (VMA)](https://github.com/GPUOpen-LibrariesAndSDKs/VulkanMemoryAllocator) to handle buffer suballocations cleanly.
- **VulkanContext:** Encapsulates the device, instance, and surface, while explicitly setting up distinct queue families—separating Graphics, Present, and dedicated Compute queues whenever the hardware supports it.
- **Immediate Execution:** A small helper (`ImmediateSubmit`) lets editor subsystems record and flush one-off staging command buffers synchronously to the GPU, making texture and mesh uploads effortless.

```cpp
// VulkanContext manages device lifecycles and dedicated queue dispatches
class VulkanContext {
public:
    VulkanContext(GLFWwindow* window, bool enableValidationLayers = true);
    ~VulkanContext();

    VkDevice GetDevice() const { return m_device; }
    VmaAllocator GetAllocator() const { return m_allocator; }
    
    khepri::VulkanQueue& GetGraphicsQueue() { return *m_graphicsQueue; }
    khepri::VulkanQueue& GetComputeQueue() { return *m_computeQueue; }

    // Quick synchronous flush for staging transfers and mesh uploads
    void ImmediateSubmit(std::function<void(VkCommandBuffer cmd)>&& action) const;
    void WaitIdle() const { vkDeviceWaitIdle(m_device); }
};
```

For the current rendering pass, I wrote a forward-shading pipeline implementing classic Blinn-Phong lighting with dynamic directional sun lights, point lights with attenuation falloffs, and specular highlights. These are the basics you can learn from OpenGL tutorials everywhere.

## Interactive Editor: Scene Tree, Inspector, and Viewport

To make Khepri fun to work with, I built an interactive docking workspace using Dear ImGui that ties the entire workflow together:

1. **Scene Tree:** A clean hierarchical view of entities, meshes, and lights. You can select, parent, rename, or delete objects with full undo support.
2. **Component Inspector:** Reflects properties on the selected entity—letting you tweak transforms, toggle wireframe modes, adjust light colors, and inspect material parameters.
3. **Viewport Controls:**
   - **3D Transform Gizmo:** Local and world-space translation, rotation, and scaling.
   - **Interactive ViewCube:** A miniature orientation cube in the corner of the viewport (similar to CAD software) for snapping the camera to orthographic and isometric views with a single click.
   - **Light Visualizer:** Renders directional vectors and point light spheres directly in the 3D scene so you can see your lighting setup visually.
4. **Asset Manager:** Handles asynchronous loading for glTF and OBJ models, keeping track of textures and shader modules without stalling the main thread.

---

## Procedural Geometry Nodes & Animation Handler

Rather than relying purely on static 3D models from Blender, I wanted Khepri to have procedural geometry generation from the get go. This also takes inspiration from my current work at Align Technology, where we work with mesh operations, and procedural geometry nodes can be useful to visualize each step in that procedural generation pipeline.

```cpp
// Procedural Geometry Nodes evaluated into Vulkan vertex buffers
class MeshPrimitiveNode : public GraphNode {
public:
    enum class PrimitiveType { Cube, Sphere, Cylinder, Plane };
    void Evaluate() override;
};

class SubdivisionNode : public GraphNode {
public:
    void Evaluate() override; // 1-to-4 midpoint topological subdivision
};

class TwistDeformerNode : public GraphNode {
public:
    void Evaluate() override; // Continuous trigonometric twist deformation
};
```

By connecting primitive nodes (`Cube`, `Sphere`, `Cylinder`) or external glTF meshes to deformers like `TwistDeformerNode` and `SubdivisionNode`, you can procedurally reshape geometry on the fly. 

To bring movement into the mix, I implemented a **Basic Animation Handler & Timeline**:
- A bottom **Timeline Panel** allows you to scrub through time, adjust frame rates, and toggle playback loops.
- Keyframes can be placed on transform channels (`Translation`, `Rotation`, `Scale`) with linear or spherical (slerp) interpolation.
- Because keyframe modifications are dispatched through `KeyframeCommand`, scrubbing and keyframing fully respect the undo/redo stack.

---

## What's Done So Far

Here's a quick summary of the milestones currently running in Khepri:

- [x] **Vulkan 1.3 Core:** Volk dynamic loader, VMA memory management, swapchain presentation, descriptor sets, and multi-frame synchronization.
- [x] **Asset Manager:** Asynchronous loading for external 3D models (glTF, OBJ) and shader caching.
- [x] **Invertible Command Stack:** Centralized undo/redo with intelligent command merging.
- [x] **Docking Editor UI:** Scene Tree, Property Inspector, Viewport with custom camera controllers, Transform Gizmo, ViewCube, and Light Visualizer.
- [x] **Lighting Pass:** Forward-rendered Blinn-Phong shading with multi-light support.
- [x] **Procedural Geometry Nodes:** Mesh primitives, subdivision, and twist deformers evaluated directly into GPU buffers.
- [x] **Timeline & Animation:** Basic keyframing, timeline scrubbing, and curve playback.
- [x] **DearImGUI Gizmos** Gizmos and Billboard Icons for lights, viewport transformations, and lighting previews.

---

## Next Steps: More Core Components

Here is what I'm looking into next to improve the engine:

1. **Better Animations & Inverse Kinematics (IK):**
   - Adding skeletal skinning matrices and bone hierarchies.
   - Implementing FABRIK and two-bone IK solvers for real-time procedural character posing.
2. **Materials & Custom Shaders:**
   - Upgrading from basic Phong to a modern PBR metallic-roughness workflow (Cook-Torrance).
   - Exposing custom compute shader hooks for GPU-based mesh deformations.
3. **More Geometry Nodes & Boolean Operations:**
   - Adding noise displacement, bend, taper, and lattice deformer nodes.
   - Implementing exact boolean mesh operations (Union, Difference, Intersection) on half-edge meshes.
4. **MPM Particle Physics:**
   - Bringing in the MPM-Lite inspired continuum mechanics pipeline so high-density sand and fluid simulations can run in real time directly inside Khepri.

There's a **LOT** to do ahead, but I'll keep on the grind. Stay hungry everyone! Until Devlog #2 --Ryan

---

### References & Citations

- **MPM Lite:** Feng, X., Chen, Y., Yu, C., Su, H., Terzopoulos, D., Yang, Y., Masterjohn, J., Castro, A., & Jiang, C. (2026). *MPM Lite: Linear Kernels and Integration without Particles*. ACM Transactions on Graphics (SIGGRAPH 2026). [Project Page](https://mpmlite.github.io/) · [GitHub](https://github.com/f1shel/mpm-lite).
