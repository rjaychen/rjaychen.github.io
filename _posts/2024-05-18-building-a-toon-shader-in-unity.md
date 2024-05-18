---
date: 2024-05-18 03:28:17
layout: post
title: "Building a Toon Shader in Unity"
subtitle: My voyage into the shader pipeline with Unity
description: How I learned how to develope shaders in Unity using various lighting, shading, and post-processing effects for a desired NPR look.
image: https://roystan.net/media/tutorials/toon-shader-demo.png
optimized_image: https://roystan.net/media/tutorials/toon-shader-demo.png
category:
tags: 
 - welcome
 - blog
 - cg
 - unity
 - hlsl
 - csharp
author: rjaychen
paginate: true
---
This marks my first step into developing my skills with Unity URP and shader graphics. I'll be highlighting some of the techniques I've learned here. 

## First Steps: A Simple Toon Shader

I took a course that worked with 2D graphics and covered a lot of core topics in Computer Graphics, but I wanted to work with 3D Graphics to expand upon those skills I learned. I've always adored animation and comics, so I took to the internet to provide me the resources I needed.

Of particular help was a Unity blog post, [Custom Lighting in Shader Graph](https://blog.unity.com/engine-platform/custom-lighting-in-shader-graph-expanding-your-graphs-in-2019), which got me started down this track of non-photorealistic rendering.

### The General Idea

From what I've learned, I like to think of shaders as blackboxes that take inputs in the form of properties, do lots of math and calculations upon those inputs, and then output a final color to display on your screen. The inputs into the shaders can be in the form of lighting characteristics, colors, UV properties, texture maps, etc., but typically the output is focused on the color at each pixel on the screen. 

In my graphics course, we went through many low-level optimizations to improve the runtime at which these calculations are done, but now I'm looking to focus more on the content of the calculations done in shaders. 

#### The Art Direction
I want to focus on a comic-book inspired art style shader that looks like something out of Spider-verse. To do this, we should follow the steps sketch and comic book artists take when making drawings, and convert that pipeline to our shader in Unity. Luckily, with the help of Shader Graph, there isn't as much code necessary to create a basic toon shader in Unity.

**add image here**

### Basic Lambert (Diffuse) Lighting
[Wiki: Lambertian Light](https://en.wikipedia.org/wiki/Lambertian_reflectance)
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
