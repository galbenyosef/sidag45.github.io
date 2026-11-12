Shader "Stillpoint/GradientSky"
{
    Properties
    {
        _Top ("Top", Color) = (0.1, 0.15, 0.35, 1)
        _Horizon ("Horizon", Color) = (0.9, 0.6, 0.5, 1)
        _Bottom ("Bottom", Color) = (0.05, 0.05, 0.08, 1)
        _Exponent ("Top Falloff", Float) = 0.6
        _SunDir ("Sun Direction", Vector) = (0, 0.1, 1, 0)
        _SunColor ("Sun Color", Color) = (1, 0.8, 0.6, 1)
        _SunSize ("Sun Sharpness", Float) = 900
        _Flash ("Flash", Float) = 0
    }
    SubShader
    {
        Tags { "Queue" = "Background" "RenderType" = "Background" "PreviewType" = "Skybox" }
        Cull Off
        ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _Top, _Horizon, _Bottom, _SunColor;
            float4 _SunDir;
            float _Exponent, _SunSize, _Flash;

            struct appdata { float4 vertex : POSITION; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos : SV_POSITION; float3 dir : TEXCOORD0; UNITY_VERTEX_OUTPUT_STEREO };

            v2f vert (appdata v)
            {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.pos = UnityObjectToClipPos(v.vertex);
                o.dir = v.vertex.xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 d = normalize(i.dir);
                float y = d.y;
                float3 col;
                if (y >= 0) col = lerp(_Horizon.rgb, _Top.rgb, pow(saturate(y), _Exponent));
                else col = lerp(_Horizon.rgb, _Bottom.rgb, pow(saturate(-y * 4.0), 0.5));
                float s = saturate(dot(d, normalize(_SunDir.xyz + float3(0, 0.0001, 0))));
                col += _SunColor.rgb * (pow(s, _SunSize) * 1.4 + pow(s, 24.0) * 0.22 + pow(s, 4.0) * 0.08);
                col += _Flash * float3(0.55, 0.6, 0.75) * (0.4 + 0.6 * saturate(y + 0.3));
                return fixed4(col, 1);
            }
            ENDCG
        }
    }
}
