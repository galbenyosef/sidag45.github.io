Shader "Stillpoint/Flat"
{
    Properties
    {
        _Color ("Color", Color) = (1, 1, 1, 1)
        _Ambient ("Ambient", Range(0, 1)) = 0.55
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

            fixed4 _Color;
            float _Ambient;
            float4 _SP_FogColor;
            float4 _SP_FogParams;
            float4 _SP_LightDir;

            struct appdata { float4 vertex : POSITION; float3 normal : NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos : SV_POSITION; float3 wpos : TEXCOORD0; float3 n : TEXCOORD1; UNITY_VERTEX_OUTPUT_STEREO };

            v2f vert (appdata v)
            {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.pos = UnityObjectToClipPos(v.vertex);
                o.wpos = mul(unity_ObjectToWorld, v.vertex).xyz;
                o.n = UnityObjectToWorldNormal(v.normal);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 n = normalize(i.n);
                float3 l = normalize(_SP_LightDir.xyz + float3(0, 0.0001, 0));
                float ndl = saturate(dot(n, l) * 0.5 + 0.5);
                float3 c = _Color.rgb * lerp(_Ambient, 1.0, ndl);
                float d = distance(i.wpos, _WorldSpaceCameraPos);
                float f = saturate((d - _SP_FogParams.x) / max(0.001, _SP_FogParams.y - _SP_FogParams.x));
                c = lerp(c, _SP_FogColor.rgb, f * _SP_FogParams.z);
                return fixed4(c, 1);
            }
            ENDCG
        }
    }
}
