using System;
using System.Collections;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.Networking;

namespace ARGraffiti.Phase0
{
    /// <summary>
    /// Minimal Supabase client over plain HTTPS (no SDK needed).
    /// Each install signs in as its own anonymous Supabase user, so two phones = two accounts.
    /// The refresh token is kept in PlayerPrefs, so the same phone stays the same account across days.
    /// </summary>
    public class SupabaseClient
    {
        const string RefreshTokenPref = "argraffiti.sb.refresh";

        readonly string _url;
        readonly string _key;

        string _accessToken;
        string _refreshToken;
        DateTime _expiresAtUtc = DateTime.MinValue;

        public string UserId { get; private set; }
        public bool IsSignedIn => !string.IsNullOrEmpty(_accessToken);
        public bool IsConfigured => !string.IsNullOrEmpty(_url) && !string.IsNullOrEmpty(_key);

        /// <summary>First 8 characters of the account id, shown on screen so testers can confirm they're on different accounts.</summary>
        public string ShortUserId => string.IsNullOrEmpty(UserId) ? "--------" : UserId.Substring(0, Math.Min(8, UserId.Length));

        public SupabaseClient(string url, string key)
        {
            _url = (url ?? "").Trim().TrimEnd('/');
            _key = (key ?? "").Trim();
            _refreshToken = PlayerPrefs.GetString(RefreshTokenPref, "");
        }

#pragma warning disable 0649 // fields are filled by JsonUtility
        [Serializable] class AuthUser { public string id; }
        [Serializable] class AuthResponse
        {
            public string access_token;
            public string refresh_token;
            public int expires_in;
            public AuthUser user;
        }
        [Serializable] class RefreshBody { public string refresh_token; }
#pragma warning restore 0649

        /// <summary>Signs in (restoring this phone's account if it has one) and refreshes the token when close to expiry.</summary>
        public IEnumerator EnsureSession(Action<string> onError)
        {
            if (!IsConfigured)
            {
                onError?.Invoke("Supabase URL / key not set in Phase0Settings.");
                yield break;
            }

            if (IsSignedIn && DateTime.UtcNow < _expiresAtUtc.AddSeconds(-60))
            {
                yield break;
            }

            string error = null;
            if (!string.IsNullOrEmpty(_refreshToken))
            {
                var body = JsonUtility.ToJson(new RefreshBody { refresh_token = _refreshToken });
                yield return Send("POST", "/auth/v1/token?grant_type=refresh_token", body, false, null,
                    text => ApplyAuth(text), e => error = e);
                if (error == null && IsSignedIn) yield break;
                Debug.LogWarning("[ARGraffiti] Refresh failed, creating a new anonymous account: " + error);
                error = null;
            }

            // Anonymous sign-up (must be enabled: Authentication > Sign In / Providers > Allow anonymous sign-ins).
            yield return Send("POST", "/auth/v1/signup", "{\"data\":{}}", false, null,
                text => ApplyAuth(text), e => error = e);

            if (error != null || !IsSignedIn)
            {
                onError?.Invoke("Sign-in failed: " + (error ?? "no token returned") +
                    "\nCheck that anonymous sign-ins are enabled in Supabase.");
            }
        }

        /// <summary>Forget this phone's account; the next EnsureSession creates a fresh one.</summary>
        public void ResetAccount()
        {
            PlayerPrefs.DeleteKey(RefreshTokenPref);
            PlayerPrefs.Save();
            _accessToken = null;
            _refreshToken = null;
            UserId = null;
        }

        void ApplyAuth(string json)
        {
            var auth = JsonUtility.FromJson<AuthResponse>(json);
            if (auth == null || string.IsNullOrEmpty(auth.access_token)) return;
            _accessToken = auth.access_token;
            _refreshToken = auth.refresh_token;
            _expiresAtUtc = DateTime.UtcNow.AddSeconds(auth.expires_in > 0 ? auth.expires_in : 3600);
            if (auth.user != null && !string.IsNullOrEmpty(auth.user.id)) UserId = auth.user.id;
            PlayerPrefs.SetString(RefreshTokenPref, _refreshToken ?? "");
            PlayerPrefs.Save();
        }

        /// <summary>Insert one row and return the inserted row (JSON object) to onOk.</summary>
        public IEnumerator Insert(string table, object row, Action<string> onOk, Action<string> onError)
        {
            string authError = null;
            yield return EnsureSession(e => authError = e);
            if (authError != null) { onError?.Invoke(authError); yield break; }

            // JsonUtility writes missing strings as "", which isn't a valid uuid. Send null for empty *_id fields.
            var body = Regex.Replace(JsonUtility.ToJson(row), "\"([a-z_]+_id)\":\"\"", "\"$1\":null");
            yield return Send("POST", "/rest/v1/" + table, body, true, "return=representation",
                text => onOk?.Invoke(FirstObject(text)), onError);
        }

        /// <summary>
        /// Select rows. <paramref name="query"/> is a PostgREST query string, e.g. "select=*&amp;order=created_at.desc&amp;limit=20".
        /// onOk receives the raw JSON array.
        /// </summary>
        public IEnumerator Select(string table, string query, Action<string> onOk, Action<string> onError)
        {
            string authError = null;
            yield return EnsureSession(e => authError = e);
            if (authError != null) { onError?.Invoke(authError); yield break; }

            yield return Send("GET", "/rest/v1/" + table + "?" + query, null, true, null, onOk, onError);
        }

        IEnumerator Send(string method, string path, string body, bool asUser, string prefer,
            Action<string> onOk, Action<string> onError)
        {
            using (var req = new UnityWebRequest(_url + path, method))
            {
                if (body != null)
                {
                    req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body));
                    req.SetRequestHeader("Content-Type", "application/json");
                }
                req.downloadHandler = new DownloadHandlerBuffer();
                req.SetRequestHeader("apikey", _key);
                if (asUser && !string.IsNullOrEmpty(_accessToken))
                {
                    req.SetRequestHeader("Authorization", "Bearer " + _accessToken);
                }
                if (!string.IsNullOrEmpty(prefer)) req.SetRequestHeader("Prefer", prefer);
                req.timeout = 20;

                yield return req.SendWebRequest();

                var text = req.downloadHandler != null ? req.downloadHandler.text : "";
                if (req.result == UnityWebRequest.Result.Success)
                {
                    onOk?.Invoke(text);
                }
                else
                {
                    onError?.Invoke($"{method} {path.Split('?')[0]} → {req.responseCode} {req.error} {Trim(text)}");
                }
            }
        }

        static string FirstObject(string jsonArray)
        {
            var t = (jsonArray ?? "").Trim();
            if (t.StartsWith("[") && t.EndsWith("]"))
            {
                t = t.Substring(1, t.Length - 2).Trim();
                // A single inserted row: strip the array brackets.
                return t;
            }
            return t;
        }

        static string Trim(string s) => string.IsNullOrEmpty(s) ? "" : (s.Length > 240 ? s.Substring(0, 240) + "…" : s);

        /// <summary>JsonUtility can't parse a top-level array, so wrap it.</summary>
        public static T[] ParseArray<T>(string jsonArray)
        {
            var wrapped = JsonUtility.FromJson<Wrapper<T>>("{\"items\":" + (string.IsNullOrEmpty(jsonArray) ? "[]" : jsonArray) + "}");
            return wrapped?.items ?? Array.Empty<T>();
        }

#pragma warning disable 0649
        [Serializable] class Wrapper<T> { public T[] items; }
#pragma warning restore 0649
    }
}
