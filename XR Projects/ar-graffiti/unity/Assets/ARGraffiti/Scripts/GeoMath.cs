using System;
using UnityEngine;

namespace ARGraffiti.Phase0
{
    /// <summary>Small, side-effect-free maths used for placement and error measurement.</summary>
    public static class GeoMath
    {
        const double EarthRadius = 6378137.0; // WGS84 equatorial radius, metres

        /// <summary>Direction projected onto the ground plane (Y removed), normalised. Zero if vertical.</summary>
        public static Vector3 Flatten(Vector3 v)
        {
            v.y = 0f;
            return v.sqrMagnitude < 1e-8f ? Vector3.zero : v.normalized;
        }

        /// <summary>Rotation that stands upright and faces from <paramref name="from"/> towards <paramref name="to"/>.</summary>
        public static bool TryFacing(Vector3 from, Vector3 to, out Quaternion rotation)
        {
            var dir = Flatten(to - from);
            if (dir == Vector3.zero)
            {
                rotation = Quaternion.identity;
                return false;
            }
            rotation = Quaternion.LookRotation(dir, Vector3.up);
            return true;
        }

        /// <summary>Distance between two points measured along the ground (ignores height).</summary>
        public static float HorizontalDistance(Vector3 a, Vector3 b)
        {
            var d = a - b;
            d.y = 0f;
            return d.magnitude;
        }

        /// <summary>
        /// How far the marker's facing is turned from the real facing (X → facing mark), in degrees.
        /// Positive = turned clockwise when seen from above. Range (-180, 180].
        /// </summary>
        public static float YawErrorDegrees(Quaternion markerRotation, Vector3 realX, Vector3 realFacingMark)
        {
            var expected = Flatten(realFacingMark - realX);
            var actual = Flatten(markerRotation * Vector3.forward);
            if (expected == Vector3.zero || actual == Vector3.zero) return float.NaN;
            return Vector3.SignedAngle(expected, actual, Vector3.up);
        }

        /// <summary>Compass heading (0 = north, 90 = east) of the +Z axis of an East-Up-North rotation.</summary>
        public static double HeadingFromEun(Quaternion eunRotation)
        {
            var f = eunRotation * Vector3.forward; // x = east, z = north
            var deg = Math.Atan2(f.x, f.z) * 180.0 / Math.PI;
            return (deg + 360.0) % 360.0;
        }

        /// <summary>Metres east and north of point A to point B (flat-earth approximation, fine over a few hundred metres).</summary>
        public static void EastNorthMetres(double latA, double lngA, double latB, double lngB,
            out double east, out double north)
        {
            var rad = Math.PI / 180.0;
            north = (latB - latA) * rad * EarthRadius;
            east = (lngB - lngA) * rad * EarthRadius * Math.Cos(((latA + latB) * 0.5) * rad);
        }
    }
}
