// attribute vec4 tangent;
// varying vec2 vUv;
// varying vec3 vWorldNormal;
// varying vec3 vWorldTangent;
// varying vec3 vWorldBitangent;
// varying vec3 vDirWs;
// varying vec3 vViewNormal;

// void main() {
//   vUv = uv;
//   vWorldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
//   vec3 transTangent = (modelMatrix * vec4(tangent.xyz, 0.0)).xyz;
//   vWorldTangent = normalize(transTangent);
//   vWorldBitangent = normalize(cross(vWorldNormal, vWorldTangent) * tangent.w);
//   vViewNormal = (modelViewMatrix * vec4(normal, 0.0)).xyz;
//   vec4 Ws = modelMatrix * vec4(position, 1.0);
//   vDirWs = normalize(cameraPosition - Ws.xyz);
// }


// varying vec2 vUv;
// varying vec3 vWorldNormal;
// varying vec3 vWorldTangent;
// varying vec3 vWorldBitangent;
// varying vec3 vDirWs;
// varying vec3 vViewNormal;
// uniform vec3 uLightPosition;
// uniform sampler2D uLightMap;
// uniform sampler2D uRampMap;
// uniform sampler2D uNormalMap;

// void main() {
//   /* 处理提前准备的数据 */
//   /* normalMap */
//   vec4 normalTex = texture2D(uNormalMap, vUv);
//   vec3 normalTs = vec3(normalTex.rg * 2. - 1., 0.);
//   normalTs.z = sqrt(1. - dot(normalTs.xy, normalTs.xy));

//   mat3 tbn = mat3(normalize(vWorldTangent), normalize(vWorldBitangent),  normalize(vWorldNormal));

//   vec3 worldNormal = normalize(tbn * normalTs);

//   vec3 dirL = normalize(uLightPosition);
//   vec3 hDirWS = normalize(vDirWs + dirL);

//   vec2 matcapUV = (normalize(vViewNormal.xy) + 1.) * .5;

//   float NDotL = dot(worldNormal, dirL); //lambert

//   NDotL = max(NDotL, 0.);

//   float NDotH = dot(worldNormal, hDirWS); //Blinn-Phong

//   float NdotV = dot(worldNormal, vDirWs); //fresnel

//   /* lightMap */
//   vec4 lightMapTex = texture2D(uLightMap, vUv);
  
//   csm_Emissive = csm_DiffuseColor.rgb;
  
//   csm_Roughness = 1.;
  
//   csm_Metalness = 0.;
// }
