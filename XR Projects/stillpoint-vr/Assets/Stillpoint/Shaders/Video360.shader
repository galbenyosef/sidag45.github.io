Shader "Stillpoint/Video360"
{
    Properties
    {
        _MainTex ("Equirectangular", 2D) = "black" {}
        _Tint ("Tint", Color) = (1, 1, 1, 1)
        _FlipU ("Flip Horizontal", Float) = 0
        _Yaw ("Yaw Offset", Range(0, 1)) = 0
    }
    SubShader
    {
        Tags { "Queue" = "Background+10" "RenderType" = "Background" }
        Cull Off
        ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            fixed4 _Tint;
            float _FlipU, _Yaw;

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
                float u = atan2(d.x, d.z) / 6.2831853 + 0.5;
                u = lerp(u, 1.0 - u, _FlipU);
                u = frac(u + _Yaw);
                float v = asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5;
                return tex2Dlod(_MainTex, float4(u, v, 0, 0)) * _Tint;
            }
            ENDCG
        }
    }
}
