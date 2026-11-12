Shader "Stillpoint/Water"
{
    Properties
    {
        _Deep ("Deep", Color) = (0.05, 0.12, 0.2, 1)
        _Spec ("Specular", Color) = (1, 0.8, 0.6, 1)
        _WaveScale ("Wave Height", Float) = 1
        _Speed ("Speed", Float) = 1
    }
    SubShader
    {
        Tags { "Queue" = "Geometry" "RenderType" = "Opaque" }
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _Deep, _Spec;
            float _WaveScale, _Speed;
            float4 _SP_FogColor;
            float4 _SP_FogParams;
            float4 _SP_LightDir;

            struct appdata { float4 vertex : POSITION; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos : SV_POSITION; float3 wpos : TEXCOORD0; float3 n : TEXCOORD1; UNITY_VERTEX_OUTPUT_STEREO };

            float waveH(float2 p, float t)
            {
                return sin(p.x * 0.15 + t * 0.8) * 0.22
                     + sin(p.y * 0.23 + t * 1.1) * 0.16
                     + sin((p.x + p.y) * 0.5 + t * 1.7) * 0.05
                     + sin((p.x * 1.3 - p.y) * 0.9 + t * 2.3) * 0.025;
            }

            v2f vert (appdata v)
            {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                float3 w = mul(unity_ObjectToWorld, v.vertex).xyz;
                float t = _Time.y * _Speed;
                float h = waveH(w.xz, t) * _WaveScale;
                float e = 0.5;
                float hx = waveH(w.xz + float2(e, 0), t) * _WaveScale;
                float hz = waveH(w.xz + float2(0, e), t) * _WaveScale;
                w.y += h;
                o.n = normalize(float3(h - hx, e, h - hz));
                o.wpos = w;
                o.pos = UnityWorldToClipPos(w);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 n = normalize(i.n);
                float3 v = normalize(_WorldSpaceCameraPos - i.wpos);
                float3 l = normalize(_SP_LightDir.xyz + float3(0, 0.0001, 0));
                float fres = pow(1.0 - saturate(dot(n, v)), 4.0);
                float3 c = lerp(_Deep.rgb, _SP_FogColor.rgb, saturate(fres * 0.9 + 0.05));
                float3 r = reflect(-v, n);
                float sp = pow(saturate(dot(r, l)), 120.0) * 1.5 + pow(saturate(dot(r, l)), 12.0) * 0.12;
                c += _Spec.rgb * sp;
                float d = distance(i.wpos, _WorldSpaceCameraPos);
                float f = saturate((d - _SP_FogParams.x) / max(0.001, _SP_FogParams.y - _SP_FogParams.x));
                c = lerp(c, _SP_FogColor.rgb, f * _SP_FogParams.z);
                return fixed4(c, 1);
            }
            ENDCG
        }
    }
}
