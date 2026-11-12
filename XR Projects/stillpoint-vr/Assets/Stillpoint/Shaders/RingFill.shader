Shader "Stillpoint/RingFill"
{
    Properties
    {
        _Color ("Fill Color", Color) = (1, 1, 1, 1)
        _BaseColor ("Track Color", Color) = (1, 1, 1, 0.2)
        _Inner ("Inner Radius", Range(0, 0.5)) = 0.38
        _Outer ("Outer Radius", Range(0, 0.5)) = 0.48
        _Fill ("Fill", Range(0, 1)) = 0
        [Enum(UnityEngine.Rendering.CompareFunction)] _ZTest ("ZTest", Float) = 4
    }
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "IgnoreProjector" = "True" }
        ZWrite Off
        Cull Off
        ZTest [_ZTest]
        Blend SrcAlpha OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _Color, _BaseColor;
            float _Inner, _Outer, _Fill;

            struct appdata { float4 vertex : POSITION; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; UNITY_VERTEX_OUTPUT_STEREO };

            v2f vert (appdata v)
            {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv - 0.5;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float r = length(i.uv);
                float aa = fwidth(r) * 1.5;
                float ring = smoothstep(_Inner - aa, _Inner + aa, r) * (1.0 - smoothstep(_Outer - aa, _Outer + aa, r));
                float ang = atan2(i.uv.x, i.uv.y) / 6.2831853;
                ang = ang < 0 ? ang + 1.0 : ang;
                float filled = step(ang, _Fill) * step(0.0001, _Fill);
                fixed4 c = lerp(_BaseColor, _Color, filled);
                c.a *= ring;
                return c;
            }
            ENDCG
        }
    }
}
