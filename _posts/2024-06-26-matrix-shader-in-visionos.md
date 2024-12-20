---
date: 2024-06-26 14:08:49
layout: post
title: "\"The Matrix\" Shader in visionOS"
subtitle: Metal Shading using RealityKit and CompositorServices
description: How to work with metal shaders to give more control over your materials in RealityKit
image: https://res.cloudinary.com/dle8qrl6x/image/upload/f_auto,q_auto/matrix-hands
optimized_image: https://res.cloudinary.com/dle8qrl6x/image/upload/t_optimized-240p,f_auto,q_auto/matrix-hands
tags:
 - blog
 - cg
 - swift
 - visionos
author: rjaychen
paginate: false
---
## SwiftUI, RealityKit, and Apple's visionOS
Development for visionOS is incredibly new, with Apple's development features still being released, updated, and documented daily at the time of writing.
Developers can choose to use SwiftUI natively to build applications for the Vision Pro, or use Unity's PolySpatial to port their features onto visionOS. 
I opted to stay with Swift and use the RealityKit/CompositorServices frameworks to learn more about visionOS development workflow. 

My goal for this short project was to use spatial computing services to implement a real-life matrix effect, similar to [this one](https://www.shadertoy.com/view/ldccW4) on ShaderToy. The idea was to make your surroundings appear as if they were being generated by matrix code on the Apple Vision Pro.
[This medium article](https://shahriyarshahrabi.medium.com/shader-studies-matrix-effect-3d2ead3a84c5) explains the effects used in the shader well and how to implement them in Unity.

I was more interested in how to use Metal shaders with the RealityKit framework, if possible. Currently, RealityKit does not provide a direct interface to use Metal shaders with materials (**CustomMaterial**). In fact, the closest proxy that one could use would be a **ShaderGraphMaterial**, which is limited in the scope of what it can do. However, with a [video from WWDC 2024](https://developer.apple.com/videos/play/wwdc2024/10104/), we see that Metal shaders can be integrated into RealityKit through the use of a **LowLevelTexture**. I'll try to explore how to setup the shader to work with LowLevelTextures in this post. 

Firstly, I played around with the shader code in metal to reproduce a similar effect using the default CompositorServices template project. Here is what it looks like: 
![Template Matrix Shader](/assets/img/template_matrix.png)

## Spatial Mesh Creation
I had previously worked a lot on the HoloLens 2 with MRTK to access spatial meshes at runtime and retexture them, so I had a lot of background going into ARKit. ARKit provides **MeshAnchors** which store the mesh data (vertices, triangleIndices, normals) obtained at runtime for your use. you can reconstruct a visual mesh by iterating over these MeshAnchors and creating a new ModelEntity based on the original mesh. Initially applying the matrix shader to these meshes: 
<iframe width="560" height="315" src="https://www.youtube.com/embed/Zn_qGsGb-ng?si=cot1hGvqXMf5Dav2" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

I will continue working on the matrix shader to improve its look in 3D. The shader was written for 2D UV Mappings, so understanding the relationship spatial mesh reconstructions have with the texture mapping will be important going forward.