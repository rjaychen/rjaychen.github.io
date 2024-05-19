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

![SpiderverseExample](https://media2.firstshowing.net/firstshowing/img15/SpidermanAcrossSpidermainimg591.jpg)

### Basic Lambert (Diffuse) Lighting

[Wiki: Lambertian Light](https://en.wikipedia.org/wiki/Lambertian_reflectance)

> A quick note! The basic lighting model uses: <br>
> surfaceColor = emissive + ambient + diffuse + specular

Diffuse lighting is the result of directed light reflecting off a surface equally in all directions. The Lambertian reflectance model provides a simple mathematical equation to calculate diffuse lighting. As a surface is tilted away from perpendicular to the light, its reflection decreases. Given a vector B and its unit direction B', the dot product of any vector A with B' provides the projection of A onto B. Essentially, the dot product allows us to determine the parallelism of two vectors with each other. 

Using these principles we obtain the following equation: 

$$ K_{d} = L \cdot N \times C \times I_{L} $$

Where $L$ is the normalized light direction vector, $N$ is the unit normal vector of the surface, $C$ is the color of the light, and $I_{L}$ is the intensity of the light source. 

![Diffuse Example](https://developer.download.nvidia.com/CgTutorial/elementLinks/fig5_7.jpg)
#### Intensity in Real Life
Unfortunately, intensity levels are not constrained between 0 and 1 in real life. In an outdoor environnment, they easily exceed the ideal levels we like to use in Computer Graphics. To solve this problem for photorealistic applications, lighting is often rendered in High Dynamic Range (HDR) or uses Tone Mapping to address the issues of exceeding intensities. In our case, we clamp the result of the dot product $N \cdot L$ between 0 and 1. 

![Diffuse Lighting Example](/assets/img/shader_blog/diffuse.png)
> I'll be using some basic shapes, along with the Utah Teapot, to test my shader and its evolution. 

### Specular Lighting
[Wiki: Phong model](https://en.wikipedia.org/wiki/Phong_reflection_model)

The Phong model is superceded by the [Blinn-Phong model](https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_reflection_model), an approximation that proves to be better in many cases, but the basic Phong model is also suitable, and describes surface light as the combination of ambient, diffuse, and specular lighting. **Specular Lighting**, or specular reflection, is the mirror-like reflection of light on a surface. This type of lighting relies on vectors pointing towards the viewer, or in our case, the camera.

In HLSL, this looks like the following: 
```
Smoothness = exp2(10 * Smoothness + 1);
WorldNormal = normalize(WorldNormal);
WorldView = SafeNormalize(WorldView);
Out = LightingSpecular(Color, Direction, WorldNormal, WorldView, half4(Specular, 0), Smoothness); 
```
Here, the user has defined the specular light in the input `Specular`, and the `LightingSpecular` function executes the following equation: 

![Specular Diagram](https://developer.download.nvidia.com/CgTutorial/elementLinks/fig5_13.jpg)

$$ specular = C \times K_{s} \times (N \cdot H)^{smoothness}$$

where $C$ is the light color, $N$ is the unit normal vector, $H$ is the unit halfway vector between the view direction and the light direction, and $smoothness$ defines how shiny a surface is. Note that we also clamp the term $N \cdot H$ here. 

![Specular Lighting Example](/assets/img/shader_blog/specular.png)
> The lighting might be hard to see here, but it usually appears as the bright white dots or lines that are directed towards the light source. Once we begin clamping intensity values in the toonifying part, they should be easier to see.

### Ambient and Emissive Lighting

Ambient light is the light scattered from around the environment onto our surface. In Shader Graph, this is handled by Global Illumination values that are baked onto the surface of an object. The exact implementation is different per render pipeline. 

Emissive light is the light given off by the object, e.g. "glowing" from the object. For our purposes, we won't consider this for now, but I might look into some interesting cases of emissive light in the future.

Now that we have some basic lighting down, let's get to the fun part: toonifying!



## Next Steps: Toonifying

Let's get started with the toon part!

Firstly, a large part of achieving a non-photo realistic look is restricting the number of colors in our palette - this is called [**Cel shading**](https://en.wikipedia.org/wiki/Cel_shading). A super easy implementation of cel shading is to floor, ceiling, or round intensity values from the light source (the only difference is a shift in where shading begins), and then use a step function to find the appropriate color to match the intensity with.  

![Step Inking](https://panthavma.com/articles/shading/toonshading/CelCode.png)
> Using a step/smoothstep function for Cel Shading <br>
> Credit: Panthavma

### Ramp Lighting / Inking

Another method we could use is **ramp lighting**, which relies on a ramp, or a 1D texture that matches a light intensity to a color ramp. In this way, we can specify what colors we want our shadows to be, and have greater control over the colors within the light falloff.

![Toon Ramp](https://panthavma.com/articles/shading/toonshading/ISLinearConst.png) ![Toon Ramp 2](https://panthavma.com/articles/shading/toonshading/ISTwoToneColorPlus.png)
> Ramp Lighting in Action <br>
> Credit: Panthavma

In Unity with Shader Graph, the effect can be achieved by converting RGBA (red, green, blue, alpha) -> HSV (hue, saturation, value), where value is the measure of light intensity. *Note that when using the Split node in Shader Graph, V is mapped to an output of B.* The value is inputted into the ramp, in the form of a simple gradient, where the artist/user can specify the color scheme for the shader. Finally, we reconvert the HSV -> RGB and use the output as our color. 

![Ramp Lighting Example](/assets/img/shader_blog/inking.png)
> You can now easily see the color palette chosen by sampling from using ramp lighting.
### Crosshatching
![Crosshatching Example](/assets/img/shader_blog/crosshatching.png)
### Outlines
![Outlines Example](/assets/img/shader_blog/outlines.png)
### Stippling
![Specular Lighting Example](/assets/img/shader_blog/stippling.png)
### Rim Lighting
![Rim Lighting Example](/assets/img/shader_blog/rims.png)



## Conclusions



## Future Work
So, that's it for now! I have a huge list of topics I want to visit and explore next, and also improve on the toon shader. Here's a short list of some topics I want to get into:
- Dithering
- Custom Renderers
- Photorealistic Shaders
- Raytracing
- Vector Colors
- More UV Maps and Textures
- Edge Detection with Sobel
- Chromatic Aberration
- Anti-Aliasing
- Streamline Hatching
- and more...

Thanks for reading!