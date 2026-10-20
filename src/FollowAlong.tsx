import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Link } from "lucide-react";
import { validFollowUrl } from "./data";
export function FollowAlong({
  url,
  onSave,
}: {
  url: string;
  onSave: (url: string) => void;
}) {
  const [draft, setDraft] = useState(url),
    [message, setMessage] = useState("");
  useEffect(() => {
    setDraft(url);
    setMessage("");
  }, [url]);
  function save(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (!validFollowUrl(next)) {
      setMessage("请填写 http 或 https 的完整跟练链接。");
      return;
    }
    onSave(next);
    setMessage("跟练链接已保存。");
  }
  return (
    <div className="follow-card">
      <div className="card-label">
        <Link size={16} />
        <h3>跟练链接</h3>
        {url && validFollowUrl(url) && (
          <a
            className="secondary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            打开跟练
            <ExternalLink size={13} />
          </a>
        )}
      </div>
      <form onSubmit={save}>
        <label className="sr-only" htmlFor="follow-url">
          本次跟练链接
        </label>
        <input
          id="follow-url"
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="粘贴视频或课程的完整链接"
          maxLength={2048}
        />
        <button className="secondary" type="submit">
          保存链接
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <small>新窗口打开，次数与消耗继续在本应用记录；外部视频需要联网。</small>
    </div>
  );
}
