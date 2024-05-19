---
date: 2024-05-18 03:28:17
layout: post
title: "Building a Toon Shader in Unity"
subtitle: My voyage into the shader pipeline with Unity
description: How I learned how to develope shaders in Unity using various lighting, shading, and post-processing effects for a desired NPR look.
image: https://roystan.net/media/tutorials/toon-shader-demo.png
optimized_image: https://roystan.net/media/tutorials/toon-shader-demo.png
category: cg
tags: 
 - blog
 - cg
 - unity
 - hlsl
 - csharp
author: rjaychen
paginate: true
math: true
---
This marks my first step into developing my skills with Unity URP and shader graphics. I'll be highlighting some of the techniques I've learned here. 

## An Preface into the Graphics Rendering Pipeline

A couple resources that greatly expanded my understanding: 
- [Cem Yuksel's CG course @ Utah](https://www.youtube.com/watch?v=vLSphLtKQ0o&list=PLplnkTzzqsZTfYh4UbhLGpI5kGd5oW_Hh) 
- [Real Time Rendering 4](https://www.realtimerendering.com/)

From these resources, I present the following simplified model of how modern GPU's work:

$$ \text{Vertex Data} \rightarrow \text{Vertex Shader} \rightarrow \text{(Geometry Shader)} \rightarrow \text{Primitive Setup/Rasterization} \rightarrow \text{Fragment Shader} \rightarrow \text{Blending} \rightarrow \text{Output}$$ 

- Vertex Shader: Takes in vertices and constructs edges, triangles, and other primitives to be used by the fragment shader, which will do math and calculate the color to display per pixel.
- Geometry Shader: Processes entire primitives and is not limited in output, but also typically expensive to use.
- Fragment Shader: Generates colors per fragment (pixel).

With this information, I began diving into constructing my first shader.

## First Steps: A Simple Toon Shader

I took a course that worked with 2D graphics and covered a lot of core topics in Computer Graphics, but I wanted to work with 3D Graphics to expand upon those skills I learned. I've always adored animation and comics, so I took to the internet to provide me the resources I needed.

I started with [Freya Holmes' Intro to Shaders](https://youtu.be/9WW5-0N1DsI?si=p-wIq5S98x9Ln38W) video on YouTube, which helped me understand most of the basics of writing shaders purely through shader code in Unity. I highly recommend anyone starting out with shaders or graphics in general to give it a quick look.

Of particular help was a Unity blog post, [Custom Lighting in Shader Graph](https://blog.unity.com/engine-platform/custom-lighting-in-shader-graph-expanding-your-graphs-in-2019), which got me started down this track of non-photorealistic rendering.

### The General Idea

From what I've learned, I like to think of shaders as blackboxes that take inputs in the form of properties, do lots of math and calculations upon those inputs, and then output a final color to display on your screen. The inputs into the shaders can be in the form of lighting characteristics, colors, UV properties, texture maps, etc., but typically the output is focused on the color at each pixel on the screen. 

In my graphics course, we went through many low-level optimizations to improve the runtime at which these calculations are done, but now I'm looking to focus more on the content of the calculations done in shaders. 

#### The Art Direction
I want to focus on a comic-book inspired art style shader that looks like something out of Spider-verse. To do this, we should follow the steps sketch and comic book artists take when making drawings, and convert that pipeline to our shader in Unity. Luckily, with the help of Shader Graph, there isn't as much code necessary to create a basic toon shader in Unity.

Constructing advanced effects involves combining several substeps that are easier to understand. In Shader Graph, the idea of abstraction becomes highly relevant as substeps can be converted to subgraphs. For a toon shader, I will outline these "substeps" in stages.

![](https://media2.firstshowing.net/firstshowing/img15/SpidermanAcrossSpidermainimg591.jpg)

### Basic Lambert (Diffuse) Lighting

[Wiki: Lambertian Light](https://en.wikipedia.org/wiki/Lambertian_reflectance)

> [!TIP]
> The Basic Lighting Model: surfaceColor = emissive + ambient + diffuse + specular

Diffuse lighting is the result of directed light reflecting off a surface equally in all directions. The Lambertian reflectance model provides a simple mathematical equation to calculate diffuse lighting. As a surface is tilted away from perpendicular to the light, its reflection decreases. Given a vector B and its unit direction B', the dot product of any vector A with B' provides the projection of A onto B. Essentially, the dot product allows us to determine the parallelism of two vectors with each other. 

Using these principles we obtain the following equation: 

$$ K_{d} = L \cdot N \times C \times I_{L} $$

Where $L$ is the normalized light direction vector, $N$ is the unit normal vector of the surface, $C$ is the color of the light, and $I_{L}$ is the intensity of the light source. 

#### Intensity in Real Life
Unfortunately, intensity levels are not constrained between 0 and 1 in real life. In an outdoor environnment, they easily exceed the ideal levels we like to use in Computer Graphics. To solve this problem for photorealistic applications, lighting is often rendered in High Dynamic Range (HDR) or uses Tone Mapping to address the issues of exceeding intensities. In our case, we clamp the result of the dot product $N \dot L$ between 0 and 1. 

![Diffuse Lighting Example](/assets/img/shader_blog/diffuse.png)

### Specular Lighting
[Wiki: Phong model](https://en.wikipedia.org/wiki/Phong_reflection_model)

--page-break--

## Next Steps: Toonifying
### Crosshatching
### Outlines
### Stippling

--page-break--

## Conclusions

--page-break--

## Future Work
