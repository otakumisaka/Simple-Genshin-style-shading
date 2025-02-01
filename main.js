import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import {
  vertexShader,
  fragmentShader,
  fragmentShaderTexture,
  vertexShaderOutline,
  fragmentShaderOutline,
  vertexShaderHairShadow,
  fragmentShaderHairShadow,
} from "./shaderlib.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from "dat.gui";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutlinePass } from "three/examples/jsm/Addons.js";
import { outline } from "three/examples/jsm/tsl/display/OutlineNode.js";

// global options
var rimLightOn = true;
var outlineOn = true;
const shadowMapOn = true;
const lightMapOn = true;
const rampMapOn = true;
var isNight = false;

// model loader flag
const mtlLoaderFlag = 0x1;
const commonTextureFlag = 0x2;

// 创建场景、相机和渲染器
const scene = new THREE.Scene();
const nearClip = 0.1;
const farClip = 1000;

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.autoClear = false;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// for image download
window.renderer = renderer;
window.scene = scene;
window.camera = camera;

// postEffecting-bloom
// 创建 Effect Composer
const composer = new EffectComposer(renderer);
const renderScenePass = new RenderPass(scene, camera);
composer.addPass(renderScenePass);
window.composer = composer;

// outline Pass
const outlinePass = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera
);
// scene obj outlinePass loading
outlinePass.renderToScreen = true;
outlinePass.edgeStrength = 3; // intensity
outlinePass.edgeGlow = 0.5; //发光
outlinePass.edgeThickness = 0.05; // width
// outlinePass.pulsePeriod = 0; //闪烁
outlinePass.usePatternTexture = false; //是否使用贴图

outlinePass.visibleEdgeColor.set("blue"); // 设置可见的颜色
outlinePass.hiddenEdgeColor.set("black"); // 设置隐藏的颜色
composer.addPass(outlinePass);
// 创建 Bloom Pass
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.3, // strength
  0.1, // radius
  0.95 // threshold
);
composer.addPass(bloomPass);
bloomPass.renderToScreen = true;

// background color
renderer.setClearColor(0x444444, 1);

// light source setting
const sunLightType = 0x1;
const pointLightType = 0x2;
const lightType = sunLightType;
var pointLight = new THREE.PointLight(0xffffff, 1.0);
pointLight.position.set(5, 20, -12);
pointLight.castShadow = true;
scene.add(pointLight);
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

var sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
// set sunLight direction
sunLight.position.set(0, 10, -12);
scene.add(sunLight);

// rim light color
const rimColor = new THREE.Color(1.0, 1.0, 1.0);

// outline settings
const outlineColor = new THREE.Color(0.0, 0.0, 0.0); // black outline, may be plug-on
const outlineOffset = 0.035;
const outlineScene = new THREE.Scene();

// Depth Texture generation
const renderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    depthTexture: new THREE.DepthTexture(),
    size: { width: window.innerWidth, height: window.innerHeight },
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    preserveDrawingBuffer:true,
  }
);

function createCustomMaterial(
  texture,
  shadowMap,
  lightMap,
  rampMap,
  metalMap,
  vs,
  fs,
  hasRimLight,
  hasOutline,
  hasShadowMap,
  hasLightMap,
  hasRampMap
) {
  const viewToWorldMatrix = new THREE.Matrix4()
    .copy(camera.matrixWorld)
    .invert();
  const customMaterial = new THREE.ShaderMaterial({
    uniforms: {
      _mainTex: {
        type: "t",
        value: texture,
      },
      _cameraDepthTexture: {
        type: "t",
        value: renderTarget.texture,
      },
      // fixed single point light and ambient light
      lightPosition: {
        value: pointLight.position,
      },
      lightIntensity: {
        value: pointLight.intensity,
      },
      lightColor: {
        value: pointLight.color,
      },
      lightType: {
        value: lightType,
      },
      ambientLight: {
        value: ambientLight.color,
      },
      ambientIntensity: {
        value: ambientLight.intensity,
      },
      viewToWorldMatrix: {
        value: viewToWorldMatrix,
      },
      viewToViewPortMatrix: {
        value: camera.projectionMatrix,
      },
      isNight: {
        value: isNight,
      },
      displayType: {
        value: 3, // overall effect
      },
    },
    vertexShader: vs,
    fragmentShader: fs,
  });
  if (hasRimLight) {
    // for rim light depth check
    var zc0 = (1.0 - farClip / nearClip) / 2.0;
    var zc1 = (1.0 + farClip / nearClip) / 2.0;
    var zc2 = zc0 / farClip;
    var zc3 = zc1 / farClip;
    let _ZBufferParams = new THREE.Vector4(zc0, zc1, zc2, zc3);
    customMaterial.uniforms.rimColor = {
      value: rimColor,
    };
    customMaterial.uniforms._ZBufferParams = {
      value: _ZBufferParams,
    };
    customMaterial.uniforms._clipParams = {
      value: new THREE.Vector2(nearClip, farClip),
    };
    customMaterial.uniforms.isRim = {
      value: true,
    };
  } else {
    customMaterial.uniforms.rimColor = {
      value: new THREE.Color(0.0, 0.0, 0.0),
    };
    customMaterial.uniforms.isRim = {
      value: false,
    };
  }

  if (hasOutline) {
    customMaterial.uniforms.outlineColor = {
      value: outlineColor,
    };
    customMaterial.uniforms.outlineOffset = {
      type: "f",
      value: outlineOffset,
    };
    customMaterial.side = THREE.FrontSide;
  }

  if (hasShadowMap && shadowMap != undefined) {
    customMaterial.uniforms._shadowMap = {
      type: "t",
      value: shadowMap,
    };
  }
  if (hasLightMap && lightMap != undefined) {
    customMaterial.uniforms._lightMap = {
      type: "t",
      value: lightMap,
    };
  }
  if (hasRampMap && rampMap != undefined) {
    customMaterial.uniforms._RampTex = {
      type: "t",
      value: rampMap,
    };
  }
  if (metalMap != undefined) {
    customMaterial.uniforms._metalMap = {
      type: "t",
      value: metalMap,
    };
  }
  return customMaterial;
}

function objectTransform(object, translate, scale) {
  object.position.x += translate.x;
  object.position.y += translate.y;
  object.position.z += translate.z;
  object.scale.set(scale.x, scale.y, scale.z);
}

// load model Part
function loadModel(modelInfo, targetScene, loaderFlag, vs, fs, transformInfo) {
  // other maps(shadow, lightmap) loading
  let shadowMap = undefined;
  let lightMap = undefined;
  let rampMap = undefined;
  const otherMapLoader = new THREE.TextureLoader();
  if (modelInfo.shadowMapPath != undefined) {
    shadowMap = otherMapLoader.load(modelInfo.shadowMapPath);
  }
  // metalMap
  let metalMap = undefined;
  if (modelInfo.metalMapPath != undefined) {
    metalMap = otherMapLoader.load(modelInfo.metalMapPath);
  }
  if ((loaderFlag & mtlLoaderFlag) != 0) {
    const mtlLoader = new MTLLoader();
    mtlLoader.load(modelInfo.texturePath, (materials) => {
      materials.preload(); // 使用 OBJLoader 加载 .obj 文件并应用材料
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.load(modelInfo.modelPath, (object) => {
        targetScene.add(object);
        outlinePass.selectedObjects.push(object);
        objectTransform(object, transformInfo.translate, transformInfo.scale);
        object.traverse((child) => {
          // child 是模型的每个子部分
          if (child instanceof THREE.Mesh) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat, index) => {
                const materialName = mat.map.source.data.src;
                // console.log("材质名称:", materialName); // 打印材质名称
                // judge face/hair material
                var isFace = false;
                var isHair = false;
                var isBody = false;
                if (
                  // hardCode 面
                  materialName.includes("%E9%9D%A2") ||
                  materialName.includes("face")
                ) {
                  isFace = true;
                }

                // hair
                if (
                  materialName.includes("%E5%8F%91") ||
                  materialName.includes("hair")
                ) {
                  isHair = true;
                  lightMap = otherMapLoader.load(modelInfo.lightMapPath[0]);
                  rampMap = otherMapLoader.load(modelInfo.rampTexPath[0]);
                }

                if (!isFace && !isHair) {
                  isBody = true;
                  lightMap = otherMapLoader.load(modelInfo.lightMapPath[1]);
                  rampMap = otherMapLoader.load(modelInfo.rampTexPath[1]);
                }

                const customMaterial = createCustomMaterial(
                  mat.map,
                  shadowMap,
                  lightMap,
                  rampMap,
                  metalMap,
                  vs,
                  fs,
                  rimLightOn,
                  outlineOn,
                  shadowMapOn,
                  lightMapOn,
                  rampMapOn
                );
                customMaterial.uniforms.isFace = {
                  value: isFace,
                };
                customMaterial.uniforms.isHair = {
                  value: isHair,
                };
                child.material[index] = customMaterial;
              });
            }
          }
        });
      });
    });
  } else if ((loaderFlag & commonTextureFlag) != 0) {
    const loader = new OBJLoader();
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(texturePath, (texture) => {
      loader.load(modelPath, (object) => {
        targetScene.add(object);
        objectTransform(object, transformInfo.translate, transformInfo.scale);
        // object.scale.set(-1.5, 1.5, -1.5);
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const customMaterial = createCustomMaterial(
              texture,
              shadowMap,
              lightMap,
              rampMap,
              metalMap,
              vs,
              fs,
              rimLightOn,
              outlineOn,
              shadowMapOn,
              lightMapOn,
              rampMapOn
            );
            child.material = customMaterial;
          }
        });
      });
    });
  }
}
let hutaoTransform = {
  scale: new THREE.Vector3(1.0, 1.0, 1.0),
  translate: new THREE.Vector3(0.0, 0, 0),
};
let hutaoModelInfo = {
  texturePath: "./model/genshin_hutao/hutao.mtl",
  modelPath: "./model/genshin_hutao/hutao.obj",
  shadowMapPath: "./model/genshin_hutao/tex/hutao_faceShadowMap.png",
  lightMapPath: [
    "./model/genshin_hutao/tex/hairLightMap.png",
    "./model/genshin_hutao/tex/bodyLightMap.png",
  ],
  rampTexPath: [
    "./model/genshin_hutao/tex/hairShadowRamp.png",
    "./model/genshin_hutao/tex/bodyShadowRamp.png",
  ],
};

let ganyuTransform = {
  scale: new THREE.Vector3(1.0, 1.0, 1.0),
  translate: new THREE.Vector3(0.0, 0, 0),
};

let ganyuModelInfo = {
  texturePath: "./model/genshin_ganyu/ganyu.mtl",
  modelPath: "./model/genshin_ganyu/ganyu.obj",
  shadowMapPath: "./model/genshin_ganyu/tex/ganyu_faceShadowMap.png",
  metalMapPath: "./model/genshin_metalMap.png",
  lightMapPath: [
    "./model/genshin_ganyu/tex/hairLightMap.png",
    "./model/genshin_ganyu/tex/bodyLightMap.png",
  ],
  rampTexPath: [
    "./model/genshin_ganyu/tex/hairShadowRamp.png",
    "./model/genshin_ganyu/tex/bodyShadowRamp.png",
  ],
};

// loadModel(
//   ganyuModelInfo,
//   outlineScene,
//   mtlLoaderFlag,
//   vertexShaderOutline,
//   fragmentShaderOutline,
//   ganyuTransform
// );
loadModel(
  ganyuModelInfo,
  scene,
  mtlLoaderFlag,
  vertexShader,
  fragmentShader,
  ganyuTransform
);

// hutao scene
// loadModel(
//   hutaoModelInfo,
//   outlineScene,
//   mtlLoaderFlag,
//   vertexShaderOutline,
//   fragmentShaderOutline,
//   hutaoTransform
// );

// loadModel(
//   hutaoModelInfo,
//   scene,
//   mtlLoaderFlag,
//   vertexShader,
//   fragmentShader,
//   hutaoTransform
// );

let pikachiuInfo = {
  texturePath: "./model/pikachiu/baseColor.png",
  modelPath: "./model/pikachiu/pikachiu.obj",
};

// 设置相机位置
camera.position.set(0, 20, -10);
camera.lookAt(new THREE.Vector3(0, 20, 30));

// set rotation orbit
const controls = new OrbitControls(camera, renderer.domElement);

// observation coordinate
const axesHelper = new THREE.AxesHelper(150);
// scene.add(axesHelper);

// test coordinate
// const boxGeo = new THREE.BoxGeometry(40, 40, 20);
// const boxMat = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// const cube = new THREE.Mesh(boxGeo, boxMat);
// scene.add(cube);

controls.update();

// GUI
// 引入dat.GUI库
const gui = new GUI();

// 创建光源位置控制器
const lightFolder = gui.addFolder("Light");
lightFolder.add(pointLight.position, "x", -50, 50).name("X Position");
lightFolder.add(pointLight.position, "y", -50, 50).name("Y Position");
lightFolder.add(pointLight.position, "z", -50, 50).name("Z Position");
// change light intensity
lightFolder
  .add(pointLight, "intensity", 0, 5)
  .name("Light Intensity")
  .onChange(() => {
    updateMaterial(scene, "lightIntensity", pointLight.intensity);
  });

// rotate pointLight, open or close
const lightRotateParams = {
  rotate: false,
};

lightFolder
  .add(lightRotateParams, "rotate")
  .name("Rotate Light")
  .onChange((value) => {
    lightRotateParams.rotate = value;
  });

function rotateLight() {
  if (lightRotateParams.rotate) {
    pointLight.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.01);
    updateMaterial(scene, "lightPosition", pointLight.position);
  } else {
    // record light position
    // console.log(pointLight.position);
  }
}

lightFolder.open();

function updateMaterial(scene, entryName, value) {
  scene.traverse(function (obj) {
    if (obj instanceof THREE.Mesh) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => {
          mat.uniforms[entryName] = {
            value: value,
          };
        });
      }
    }
  });
}
// Day or Night
const timeFolder = gui.addFolder("Time of Day");
const timeParams = {
  time: "Day",
};
timeFolder
  .add(timeParams, "time", ["Day", "Night"])
  .name("Time of Day")
  .onChange((value) => {
    if (value === "Day") {
      updateMaterial(scene, "isNight", false);
    } else {
      updateMaterial(scene, "isNight", true);
    }
  });
timeFolder.open();

// rimLight open or close
const rimLightFolder = gui.addFolder("Rim Light");
const rimLightParams = {
  rimLight: "On",
};
rimLightFolder
  .add(rimLightParams, "rimLight", ["On", "Off"])
  .name("Rim Light")
  .onChange((value) => {
    if (value === "On") {
      updateMaterial(scene, "isRim", true);
    } else {
      updateMaterial(scene, "isRim", false);
    }
  });

rimLightFolder.open();
// sunLight or pointLight
const lightTypeFolder = gui.addFolder("Light Type");
const lightTypeParams = {
  lightType: "PointLight",
};
lightTypeFolder
  .add(lightTypeParams, "lightType", ["PointLight", "SunLight"])
  .name("Light Type")
  .onChange((value) => {
    if (value === "PointLight") {
      updateMaterial(scene, "lightPosition", pointLight.position);
      updateMaterial(scene, "lightIntensity", pointLight.intensity);
      updateMaterial(scene, "lightColor", pointLight.color);
      updateMaterial(scene, "lightType", pointLightType);
    } else {
      updateMaterial(scene, "lightPosition", sunLight.position);
      updateMaterial(scene, "lightIntensity", sunLight.intensity);
      updateMaterial(scene, "lightColor", sunLight.color);
      updateMaterial(scene, "lightType", sunLightType);
    }
  });
lightTypeFolder.open();

// bloom open or close
const bloomFolder = gui.addFolder("Bloom");
const bloomParams = {
  bloom: "On",
};
bloomFolder
  .add(bloomParams, "bloom", ["On", "Off"])
  .name("Bloom")
  .onChange((value) => {
    if (value === "On") {
      // stop bloom
      bloomPass.enabled = true;
    } else {
      bloomPass.enabled = false;
    }
  });
bloomFolder.open();

// outline open or close
const outlineFolder = gui.addFolder("Outline");
const outlineParams = {
  outline: "On",
};

outlineFolder
  .add(outlineParams, "outline", ["On", "Off"])
  .name("Outline")
  .onChange((value) => {
    if (value === "On") {
      outlinePass.enabled = true;
    } else {
      outlinePass.enabled = false;
    }
  });
outlineFolder.open();

// add a folder to select different render effect
// Possible selections include
// (a).albedo (b).diffuse (c).specular (d).overall  (e).rimLight (f). specular + rimLight
const effectFolder = gui.addFolder("Effect");
const effectParams = {
  effect: "Overall",
};
effectFolder
  .add(effectParams, "effect", [
    "Albedo",
    "Diffuse",
    "Specular",
    "Overall",
    "RimLight",
    "Specular + RimLight",
    "LightMapR",
    "LightMapG",
    "LightMapB",
    "LightMapA",
  ])
  .name("Effect")
  .onChange((value) => {
    if (value === "Albedo") {
      updateMaterial(scene, "displayType", 0);
    } else if (value === "Diffuse") {
      updateMaterial(scene, "displayType", 1);
    } else if (value === "Specular") {
      updateMaterial(scene, "displayType", 2);
    } else if (value === "Overall") {
      updateMaterial(scene, "displayType", 3);
    } else if (value === "RimLight") {
      updateMaterial(scene, "displayType", 4);
    } else if (value === "Specular + RimLight") {
      updateMaterial(scene, "displayType", 5);
    } else if (value === "LightMapR") {
      updateMaterial(scene, "displayType", 6);
    } else if (value === "LightMapG") {
      updateMaterial(scene, "displayType", 7);
    } else if (value === "LightMapB") {
      updateMaterial(scene, "displayType", 8);
    } else if (value === "LightMapA") {
      updateMaterial(scene, "displayType", 9);
    }
  });

// 渲染循环
function animate() {
  controls.update();
  rotateLight();
  renderer.clear();
  composer.render();
  requestAnimationFrame(animate);
}
animate();
