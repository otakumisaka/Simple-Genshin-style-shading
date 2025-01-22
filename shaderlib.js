let vertexShader = `
    uniform vec3 color;
    uniform vec3 lightPosition;
    varying vec3 vColor; // now useless
    varying vec3 vPosition;
    varying vec3 vNormal; // World Normal
    varying vec3 vLightDir; // World Light Dir
    varying vec3 vLight; // World Light Position
    varying vec3 vDir; // World View Dir
    varying vec2 vUv;

    varying vec3 viewLight;
    varying vec3 viewLightDir;
    varying vec3 viewPosition;
    varying vec3 viewDir;
    varying vec3 viewNormal;
    varying vec4 viewPortPos;

    vec4 ComputeScreenPos(vec4 pos) {
        vec4 o = pos * 0.5;
        o.xy = vec2(o.x, o.y) + o.w;
        o.zw = pos.zw;
        return o;
    }

    void main() {
        vColor = color;
        vUv = uv;
        vPosition = position;
        vNormal = normal;
        // vLightDir = normalize(lightPosition - vPosition); // For point light
        vLightDir = normalize(lightPosition); // For directional light
        vLight = lightPosition;
        vDir = normalize(cameraPosition - vPosition);

        // transform light position to viewspace
        viewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        viewDir = (modelViewMatrix * vec4(vDir, 0.0)).xyz;
        viewNormal = normalize(normalMatrix * normal);
        viewLight = normalize(modelViewMatrix * vec4(vLight, 1.0)).xyz;
        viewLightDir = normalize(modelViewMatrix * vec4(vLightDir, 0.0)).xyz;
        // clip space position
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

        // calculate viewPortPos
        viewPortPos = ComputeScreenPos(gl_Position);
    }
`;

let vertexShaderHairShadow = `
    uniform vec3 color;
    uniform vec3 lightPosition;
    varying vec3 vColor; // now useless
    varying vec3 vPosition;
    varying vec3 vNormal; // World Normal
    varying vec3 vLightDir; // World Light Dir
    varying vec3 vLight; // World Light Position
    varying vec3 vDir; // World View Dir
    varying vec2 vUv;

    varying vec3 viewLight;
    varying vec3 viewLightDir;
    varying vec3 viewPosition;
    varying vec3 viewDir;
    varying vec3 viewNormal;
    uniform bool enableRender;

    void main() {
    // move hair vertex along normal
        if(!enableRender)
        {
            gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
        // move hair vertex along light direction
        float worldspaceZOffset = 0.0;
        vPosition = vec3(position.xy, position.z + worldspaceZOffset);
        vColor = color;
        vUv = uv;
        vNormal = normal;
        vLightDir = normalize(lightPosition - vPosition);
        vLight = lightPosition;
        vDir = normalize(cameraPosition - vPosition);

        // transform light position to viewspace
        viewPosition = (modelViewMatrix * vec4(vPosition, 1.0)).xyz;
        viewDir = (modelViewMatrix * vec4(vDir, 0.0)).xyz;
        viewNormal = normalize(normalMatrix * normal);
        viewLight = normalize(modelViewMatrix * vec4(vLight, 1.0)).xyz;
        viewLightDir = normalize(modelViewMatrix * vec4(vLightDir, 0.0)).xyz;
        // clip space position
        float viewSpaceLightOffset = -0.1;
        vec3 viewSpaceOffsetPos = vec3(viewPosition.xy + viewLightDir.xy * viewSpaceLightOffset, viewPosition.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(viewSpaceOffsetPos, 1.0);

    }
`;

let fragmentShaderHairShadow = `
    precision mediump float;
    varying vec3 vColor;
    varying vec3 vPosition;
    varying vec3 vDir; // World View Dir
    varying vec3 vNormal;
    varying vec3 vLightDir;
    varying vec3 vLight;
    varying vec2 vUv;

    varying vec3 viewLight;
    varying vec3 viewLightDir;
    varying vec3 viewPosition;
    varying vec3 viewDir;
    varying vec3 viewNormal;

    void main()
    {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
`;

let fragmentShader = `
    precision mediump float;
    varying vec3 vColor;
    varying vec3 vPosition;
    varying vec3 vDir; // World View Dir
    varying vec3 vNormal;
    varying vec3 vLightDir;
    varying vec3 vLight;
    varying vec2 vUv;

    varying vec3 viewLight;
    varying vec3 viewLightDir;
    varying vec3 viewPosition;
    varying vec3 viewDir;
    varying vec3 viewNormal;
    varying vec4 viewPortPos;
    // all textures
    uniform sampler2D _mainTex;
    uniform sampler2D _shadowMap;
    uniform sampler2D _lightMap;
    uniform sampler2D _RampTex;
    uniform sampler2D _metalMap;
    uniform sampler2D _cameraDepthTexture;

    uniform int lightType;
    // light settings
    uniform float lightIntensity;
    uniform vec3 lightColor;
    uniform vec3 ambientLight;
    uniform float ambientIntensity;
    // rim light
    uniform bool isRim;
    uniform vec3 rimColor;
    uniform vec4 _ZBufferParams;
    uniform vec2 _clipParams;
    // component control
    uniform bool isFace;
    uniform bool isHair;
    // camera settings
    uniform mat4 viewToWorldMatrix;
    uniform mat4 viewToViewPortMatrix;
    uniform bool isNight;

    #define PI 3.14159265359
    #define _shadowSmooth 0.5
    #define _shadowRange 0.8
    #define _sunLightType 0x1
    #define _pointLightType 0x2 

    // display control
    uniform int displayType;
    #define albedoEffect 0x0
    #define diffuseEffect 0x1
    #define specularEffect 0x2
    #define overallEffect 0x3
    #define rimLightEffect 0x4
    #define specularRimEffect 0x5

    float LinearEyeDepth(float depth) 
    { 
        return 1.0 / (depth * _ZBufferParams.z + _ZBufferParams.w);
    }

    float Linear01Depth(float depth) 
    { 
        return 1.0 / (depth * _ZBufferParams.x + _ZBufferParams.y);
    }

    float perspectiveDepthToViewZ(float depth, float near, float far)
    {
        return (near * far) / ((far - near) * depth - far);
    }

    float viewZToOrthographicDepth(float viewZ, float near, float far)
    {
        return min(max((viewZ + near) / (near - far), 0.0), 1.0);
    }

    float readDepth(sampler2D depthSampler, vec2 coord) 
    {
        float fragCoordZ = texture2D(depthSampler, coord).x;
        float viewZ = perspectiveDepthToViewZ(fragCoordZ, _clipParams.x, _clipParams.y);
        return viewZToOrthographicDepth(viewZ, _clipParams.x, _clipParams.y);
    }

    vec3 getRimLight(vec3 worldViewDir, vec3 worldNormal, vec3 rimColor)
    {
        // rim light
        // move the vertex along the normal, check the depth of the vertex
        // if difference is smaller than threshold, then it's a rim
        float offset = 0.01;
        vec2 screenPosXY = viewPortPos.xy / viewPortPos.w;
        vec2 sampleViewPortPos = screenPosXY + offset * viewNormal.xy;

        float rimIntensity = 1.0;
        // float depth = texture2D(_cameraDepthTexture, viewPortPos.xy).r;
        // float linearDepth = LinearEyeDepth(depth);
        // float moveDepth = texture2D(_cameraDepthTexture, sampleViewPortPos.xy).r;
        // // float linearMoveDepth = LinearEyeDepth(moveDepth);
        // // float linearDepth = readDepth(_cameraDepthTexture, viewPortPos.xy);
        // float linearMoveDepth = readDepth(_cameraDepthTexture, sampleViewPortPos);
        // float depthDiff = clamp(linearMoveDepth - linearDepth, 0.0, 1.0);
        // float rimThreshold = 0.07;
        // rimIntensity = smoothstep(rimThreshold, 1.0, depthDiff);


        float FresnelMask = 0.95;
        float rimFactor = 1.0 - max(dot(worldNormal, worldViewDir), 0.0);
        rimFactor = smoothstep(0.0, 1.0, rimFactor);
        rimFactor = pow(rimFactor, exp(mix(0.0, 4.0, FresnelMask)));
        // rimFactor = 0.5 * rimFactor + 0.5;
        rimColor *= rimIntensity * rimFactor;
        return rimColor;
    }

    float getFaceShadow(vec3 worldLightDir)
    {
        vec2 faceUV = vUv;
        vec2 faceInvUV = vec2(1.0 - faceUV.x, faceUV.y);
        float shadowLeft = texture2D(_shadowMap, faceUV).r;
        float shadowRight = texture2D(_shadowMap, faceInvUV).r;

        bool superShadowSampling = true;
        if(superShadowSampling)
        {
            // super sampling
            // use the height and width of target image to calculate the pixel size
            vec2 pixelSize = 1.0 / vec2(textureSize(_shadowMap, 0));
            vec2 offsets[4];
            offsets[0] = vec2(-pixelSize.x, pixelSize.y);//↖
            offsets[1] = vec2(pixelSize.x, pixelSize.y);//↗
            offsets[2] = vec2(-pixelSize.x, -pixelSize.y);//↙
            offsets[3] = vec2(pixelSize.x, -pixelSize.y);//↘
            float shadowAccLeft = 0.0;
            float shadowAccRight = 0.0;
            for(int i = 0; i < 4; i++)
            {
                vec2 uvOffset = faceUV + offsets[i];
                vec2 invUVOffset = vec2(1.0 - uvOffset.x, uvOffset.y);
                float shadowLeft = texture2D(_shadowMap, uvOffset).r;
                float shadowRight = texture2D(_shadowMap, invUVOffset).r;
                shadowAccLeft += shadowLeft;
                shadowAccRight += shadowRight;
            }
            shadowLeft = shadowAccLeft / 4.0;
            shadowRight = shadowAccRight / 4.0;
        }
        // // according to the angle between light and forward direction of the face,
        // // we can determine the shadow
        vec3 forwardDir = vec3(0.0, 0.0, 1.0);
        vec3 RightDir = vec3(1.0, 0.0, 0.0);
        vec3 forwardDirWorld = normalize(viewToWorldMatrix * vec4(forwardDir, 0.0)).xyz;
        vec3 RightDirWorld = normalize(viewToWorldMatrix * vec4(RightDir, 0.0)).xyz;
        vec3 LeftDirWorld = -RightDirWorld;

        float faceShadowOffset = 0.15;
        float sinx = sin(faceShadowOffset);
        float cosx = cos(faceShadowOffset);
        mat2 rotMat1 = mat2(cosx, sinx, -sinx, cosx);
        mat2 rotMat2 = mat2(cosx, -sinx, sinx, cosx);
        vec2 rotateLightDir = normalize(rotMat2 * worldLightDir.xz);
        // if back face, then don't need shadow
        float FdotL = dot(forwardDirWorld.xz, rotateLightDir);
        float RdotL = dot(RightDirWorld.xz, rotateLightDir);
        float LdotL = dot(LeftDirWorld.xz, rotateLightDir);
        
        // float shadowTex = RdotL > 0.0 ? shadowRight : shadowLeft;
        float shadowTex = mix(shadowLeft, shadowRight, smoothstep(0.0, 1.0, RdotL));
        
        float faceShadowThreshold = RdotL > 0.0 ? (1.0 - acos(RdotL) / PI * 2.0) : (acos(RdotL) / PI * 2.0 - 1.0);
        
        float shadowFront = step(faceShadowThreshold, shadowTex);  
        float shadowBehind = step(0.0, FdotL);
        float shadow = shadowFront * shadowBehind;
        // shadow change so rapidly, slow it down
        // Should we use smoothstep, pow, or sin/cos or other functions?
        shadow = smoothstep(0.0, 1.0, shadow);
        shadow = pow(shadow, 0.5);


        return shadow;
    }

    vec3 AdjustColor(vec3 color)
    {
        float Brightness = 1.0;
        float Saturation = 1.2;
        float Contrast = 1.03;

        // Apply brightness
        vec3 finalColor = color.rgb * Brightness;

        // Apply saturation
        float luminance = 0.2125 * color.r + 0.7154 * color.g + 0.0721 * color.b;
        vec3 luminanceColor = vec3(luminance, luminance, luminance);
        finalColor = mix(luminanceColor, finalColor, Saturation);

        // Apply contrast
        vec3 avgColor = vec3(0.5, 0.5, 0.5);
        finalColor = mix(avgColor, finalColor, Contrast);
                
        return finalColor;
    }


    void main()
    {
       vec4 albedoColor = texture2D(_mainTex, vUv);
       vec4 lightMapColor = texture2D(_lightMap, vUv); 
        vec3 baseColor = albedoColor.xyz * lightColor;
       // World Space data
        vec3 worldNormal = normalize(vNormal);
        vec3 worldLight = normalize(vLight);
        vec3 worldViewDir = normalize(vDir);
        vec3 worldLightDir = vLightDir;

        // ambient calculation
        float ambientOcclusion = step(0.8, lightMapColor.g);
        vec3 ambientColor = ambientOcclusion * ambientIntensity *ambientLight * baseColor;
        // vec3 ambientColor = vec3(0.0, 0.0, 0.0);


        // specular color
        vec3 finalSpecularColor = vec3(0.0, 0.0, 0.0);

        // diffuse lighting, and AO
        vec3 diffuseColor = vec3(0.0, 0.0, 0.0);
        // base bling-phong diffuse
        // seperate the light part and dark part
        diffuseColor = baseColor * smoothstep(_shadowRange + _shadowSmooth, 1.0, dot(worldNormal, worldLightDir));
     
        // Ramp Shadow
        if(!isFace)
        {
            float halfLambert = 0.5 * dot(worldNormal, worldLightDir) + 0.5;
            // halfLambert = pow(halfLambert, 2.0);
            float _rampShadowRange = 0.8;
            float shadowAO = smoothstep(-0.1, 0.2, lightMapColor.g);
            float shadowAO2 = smoothstep(0.1, lightMapColor.g, 0.7);
            // rampU sampling
            // Ramp Texture is 256 x 20
            // Warm Light is 256 x 10, and Cold Light is 256 x 10
            // NightV = DayV + 0.5; 
            float rampPixelU = 1.0 / 256.0;
            float rampPixelV = 1.0 / 32.0;
            float rampU = 0.0;
            float rampV = 0.0;
            
            rampU = clamp(halfLambert * shadowAO2, rampPixelU, 1.0 - rampPixelU);
            if(isHair)
            {
                float thresholdRampV = step(0.5, lightMapColor.a);
                rampV = rampPixelV * (33.0 - 2. * mix(1.0, 3.0, thresholdRampV));
                if(isNight)
                {
                    rampV = rampPixelV * (17.0 - 2. * mix(1.0, 3.0, thresholdRampV));
                }
            }
            else // body
            {
                rampV = rampPixelV * (33.0 - 2. * (lightMapColor.a * 4.0 + 1.0));
                // float rampV = rampPixelV * mix(0.0, 10.0, smoothstep(0.0, 1.0, lightMapColor.a));
                if(isNight)
                {
                    rampV  = rampPixelV * (17.0 - 2. * (lightMapColor.a * 4.0 + 1.0));
                }
            }

            vec2 rampUV = vec2(rampU, rampV);
            vec3 rampShadowColor = vec3(1.0, 1.0, 1.0);
            // get ramp color
            vec3 rampColor = texture2D(_RampTex, rampUV).xyz;
            rampColor = mix( rampColor * baseColor * rampShadowColor, baseColor , step(_rampShadowRange, halfLambert * shadowAO2));
            diffuseColor = rampColor;


            // bling-phong specular
            vec3 worldHalfDir = normalize(worldLightDir + worldViewDir);
            float NdotH = max(dot(worldNormal, worldHalfDir), 0.0);
            float phongSpecIntensity = lightIntensity;
            float phongSpecCoeff = pow(NdotH, 4.0) * phongSpecIntensity;
            vec3 phongSpecColor = phongSpecCoeff * lightColor;
            finalSpecularColor += phongSpecColor;

            // specular color with lightmap
            float specSpecularIntensity = lightMapColor.b;
            float specSecularMask = lightMapColor.r;
            float NdotV = dot(worldNormal, worldViewDir);
            float anisoFresnel = pow((1.0 - clamp(NdotV, 0.0, 1.0)), 32.0) * specSpecularIntensity;
            float NdotL = dot(worldNormal, worldLightDir);
            float anisoHalfLambert = 0.5 * NdotL + 0.5;
            float anisoSpecular = clamp(1.0 - anisoFresnel, 0.0, 1.0) * specSecularMask * anisoHalfLambert * 0.3;
            finalSpecularColor += anisoSpecular;
            
            // metal Specular
            vec2 matcapUV = (normalize(worldNormal.xy) + 1.0) * 0.5;
            vec4 metalMapColor = texture2D(_metalMap, matcapUV);
            vec3 finalMetalSpecColor = mix(vec3(0.0), metalMapColor.xyz, step(0.92, lightMapColor.r));
            finalSpecularColor += finalMetalSpecColor;

            finalSpecularColor = mix(vec3(0.0), finalSpecularColor * baseColor, lightMapColor.b);
            finalSpecularColor *= shadowAO;
        } 


        vec3 finalColor = diffuseColor + ambientColor + finalSpecularColor;


        // face shadow
        if(isFace)
        {
            float faceShadow = getFaceShadow(worldLightDir);
            
            finalColor = mix(0.8*finalColor, finalColor, faceShadow);        
        }
        // rim light
        vec3 finalRimColor = vec3(0.0);
        if(isRim)
        {
            finalRimColor = getRimLight(worldViewDir, worldNormal, rimColor) * baseColor;
            finalColor += finalRimColor;
        }
        // select display type
        switch(displayType)
        {
            case albedoEffect:
                finalColor = baseColor;
                break;
            case diffuseEffect:
                finalColor = diffuseColor;
                break;
            case specularEffect:
                finalColor = finalSpecularColor;
                break;
            case overallEffect:
                finalColor = finalColor;
                break;
            case rimLightEffect:
                finalColor = finalRimColor;
                break;
            case specularRimEffect:
                finalColor = finalSpecularColor + finalRimColor;
                break;
            default:
                break;
        }
        // finalColor = vec3(lightMapColor.r, lightMapColor.g, lightMapColor.b);
        // adjust to the final color, brightness, saturation, contrast
        finalColor = AdjustColor(finalColor);
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

let fragmentShaderTexture = `
    precision mediump float;
    varying vec3 vColor;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 viewLight;
    varying vec3 viewPosition;
    varying vec3 viewNormal;
    uniform sampler2D _mainTex;

    void main()
    {
        vec4 albedoColor = texture2D(_mainTex, vUv);
        gl_FragColor = albedoColor;
    }
`;

let vertexShaderOutline = `
    uniform vec3 color;
    uniform vec3 lightPosition;
    uniform float outlineOffset;
    varying vec3 vColor; // now useless
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 viewLight;
    varying vec3 viewPosition;
    varying vec3 viewNormal;

    void main()
    {
        vColor = color;
        vUv = uv;
        vPosition = position;  
        // offset vertex along normal
        vec3 newPosition = position + outlineOffset * normal;
        // transform light position to viewspace
        viewPosition = (modelViewMatrix * vec4(newPosition, 1.0)).xyz;
        viewNormal = normalize(normalMatrix * normal);
        viewLight = normalize(modelViewMatrix * vec4(lightPosition, 0.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
`;

let fragmentShaderOutline = `
    precision mediump float;
    varying vec3 vColor;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 viewLight;
    varying vec3 viewPosition;
    varying vec3 viewNormal;
    uniform vec3 outlineColor;
    uniform sampler2D _mainTex;
    uniform vec3 lightIntensity;
    uniform vec3 ambientLight;

    void main()
    {
        gl_FragColor = vec4(outlineColor, 1.0);
    }
`;

export {
  vertexShader,
  fragmentShader,
  fragmentShaderTexture,
  vertexShaderOutline,
  fragmentShaderOutline,
  vertexShaderHairShadow,
  fragmentShaderHairShadow,
};
