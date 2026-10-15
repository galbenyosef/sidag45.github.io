using System;

namespace ARGraffiti.Phase0
{
    // Field names match the Supabase column names exactly (see supabase/schema.sql).
    // Insert classes omit id / created_at / created_by / user_id, which the database fills in.

    [Serializable]
    public class AnchorInsert
    {
        public string label;
        public string spot;
        public string light;
        public string anchor_type;          // "terrain" or "wgs84"
        public double latitude;
        public double longitude;
        public double altitude;             // WGS84 metres of the X at placement time
        public double altitude_above_terrain;
        public double eun_x, eun_y, eun_z, eun_w;
        public double heading_deg;          // compass bearing the marker faces, for humans
        public double place_h_acc;
        public double place_v_acc;
        public double place_yaw_acc;
        public string platform;
        public string device_model;
        public string app_version;
    }

    [Serializable]
    public class AnchorRow : AnchorInsert
    {
        public string id;
        public string created_at;
        public string created_by;
    }

    [Serializable]
    public class ResolveSessionInsert
    {
        public string anchor_id;
        public string platform;
        public string device_model;
        public string app_version;
        public string spot;
        public string light;
        public bool cold_start;
        public bool is_placer;
        public bool success;
        public string state;                // TerrainAnchorState / tracking outcome
        public bool gate_met;               // localization reached the resolve gate before we resolved
        public double gate_wait_s;          // load tapped → localization good enough
        public double resolve_s;            // resolve called → anchor tracking
        public double lock_s;               // load tapped → marker visible (the brief's "lock time")
        public double h_acc;
        public double v_acc;
        public double yaw_acc;
    }

    [Serializable]
    public class ResolveSessionRow : ResolveSessionInsert
    {
        public string id;
        public string created_at;
        public string user_id;
    }

    [Serializable]
    public class MeasurementInsert
    {
        public string anchor_id;
        public string session_id;
        public string platform;
        public string device_model;
        public string spot;
        public string light;
        public bool is_placer;
        public double horizontal_error_m;   // marker centre vs the real X, along the ground
        public bool direction_known;        // false if Earth tracking dropped while measuring
        public double east_error_m;         // + = marker sits east of the X
        public double north_error_m;        // + = marker sits north of the X
        public double vertical_error_m;     // + = marker floats above the ground at the X
        public double yaw_error_deg;        // + = marker turned clockwise (seen from above) vs the real facing
        public double camera_distance_m;
        public double h_acc;
        public double v_acc;
        public double yaw_acc;
        public bool low_confidence;
        public double hours_since_placed;
    }
}
