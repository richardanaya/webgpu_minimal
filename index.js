// check for webgpu
if (navigator.gpu) {
  console.log("webgpu is supported");
} else {
  throw new Error("webgpu is not supported");
}

async function main() {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const canvas = document.querySelector("#canvas");
  const context = canvas.getContext("webgpu");
  const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: preferredFormat,
    alphaMode: "opaque",
  });

  const positions = new Float32Array([
    1.0, -1.0, 0.0, 
    -1.0, -1.0, 0.0, 
    0.0, 1.0, 0.0,
  ]);

  const colors = new Float32Array([
    1.0, 0.0, 0.0, // 🔴
    0.0, 1.0, 0.0, // 🟢
    0.0, 0.0, 1.0, // 🔵
  ]);

  const indices = new Uint32Array([0, 1, 2]);
  const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(positionBuffer.getMappedRange()).set(positions);
  positionBuffer.unmap();
  const colorBuffer = device.createBuffer({
    size: colors.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(colorBuffer.getMappedRange()).set(colors);
  colorBuffer.unmap();
  const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  });
  new Uint32Array(indexBuffer.getMappedRange()).set(indices);
  indexBuffer.unmap();

  const vertexModule = device.createShaderModule({
    code: `
        struct VSOut {
            @builtin(position) Position: vec4<f32>,
            @location(0) color: vec3<f32>,
        };
        
        @vertex
        fn main(@location(0) inPos: vec3<f32>,
                @location(1) inColor: vec3<f32>) -> VSOut {
            var vsOut: VSOut;
            vsOut.Position = vec4<f32>(inPos, 1.0);
            vsOut.color = inColor;
            return vsOut;
        }`,
  });

  const fragmentModule = device.createShaderModule({
    code: `
        @fragment
    fn main(@location(0) inColor: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(inColor, 1.0);
    }
    `,
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [],
  });

  pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: vertexModule,
      entryPoint: "main",
      buffers: [
        {
          attributes: [
            {
              shaderLocation: 0, // @location(0)
              offset: 0,
              format: "float32x3",
            },
          ],
          arrayStride: 4 * 3, // sizeof(float) * 3
          stepMode: "vertex",
        },
        {
          attributes: [
            {
              shaderLocation: 1, // @location(1)
              offset: 0,
              format: "float32x3",
            },
          ],
          arrayStride: 4 * 3, // sizeof(float) * 3
          stepMode: "vertex",
        },
      ],
    },
    fragment: {
      module: fragmentModule,
      entryPoint: "main",
      targets: [
        {
          format: preferredFormat,
        },
      ],
    },
    primitive: {
      frontFace: "cw",
      cullMode: "none",
      topology: "triangle-list",
    },
  });

  const queue = device.queue;

  const render = () => {
    const commandEncoder = device.createCommandEncoder();

    const drawTriangleCommands = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    drawTriangleCommands.setPipeline(pipeline);
    drawTriangleCommands.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    drawTriangleCommands.setScissorRect(0, 0, canvas.width, canvas.height);
    drawTriangleCommands.setVertexBuffer(0, positionBuffer);
    drawTriangleCommands.setVertexBuffer(1, colorBuffer);
    drawTriangleCommands.setIndexBuffer(indexBuffer, "uint32");
    drawTriangleCommands.drawIndexed(3);
    drawTriangleCommands.end();

    const commands = commandEncoder.finish();

    queue.submit([commands]);

    
    /* const randomColor =new Float32Array([
      Math.random(), Math.random(), Math.random(),
      Math.random(), Math.random(), Math.random(),
      Math.random(), Math.random(), Math.random(),
    ]);

    device.queue.writeBuffer(colorBuffer, 0, randomColor, 0, 9);*/

    requestAnimationFrame(render);
  };

  render();
}

main();
