import { Bell, BellOff } from "lucide-react";
import { usePushReminder } from "./push";
export type PushControls = ReturnType<typeof usePushReminder>;
export function PushSettings({ push }: { push: PushControls }) {
  return (
    <section className="panel push-settings">
      <div className="card-label">
        <Bell size={20} />
        <h2>后台休息提醒</h2>
      </div>
      <p>
        切去看视频或锁屏后，休息到点发送系统通知。iPhone
        请先添加到主屏幕，再开启通知。
      </p>
      <div className="push-status" role="status">
        <span className={push.enabled ? "push-light on" : "push-light"} />
        {push.status}
      </div>
      {push.failure && (
        <p className="push-failure" role="alert">
          {push.failure}
        </p>
      )}
      <div className="button-row">
        {push.enabled ? (
          <>
            <button
              className="primary"
              disabled={push.busy}
              onClick={() => void push.test()}
            >
              <Bell size={16} />
              10 秒后测试通知
            </button>
            <button
              className="secondary"
              disabled={push.busy}
              onClick={() => void push.disable()}
            >
              <BellOff size={16} />
              关闭后台通知
            </button>
            {push.failure && (
              <button
                className="secondary"
                disabled={push.busy}
                onClick={push.retry}
              >
                重试同步
              </button>
            )}
          </>
        ) : (
          <>
            <button
              className="primary"
              disabled={push.busy || !push.initialized}
              onClick={() => void push.enable()}
            >
              <Bell size={16} />
              {push.busy ? "正在开启…" : "开启后台通知"}
            </button>
            {push.failure && (
              <button
                className="secondary"
                disabled={push.busy}
                onClick={() => void push.disable()}
              >
                重试取消
              </button>
            )}
          </>
        )}
      </div>
      <p className="muted">
        需要联网，通知可能因网络、专注模式或系统设置延迟。首次开启后请用测试按钮实际验证。暂停、重置、结束训练会取消已安排的提醒；请等界面确认后再切去后台。
      </p>
      <p className="muted">
        开启后仅发送此设备的推送订阅信息、随机设备凭证和提醒到期时间。服务在发送或取消后删除订阅信息，状态最长保留一小时；不接收动作、重量或训练记录。通知开关只在当前设备生效，不随备份迁移。
      </p>
    </section>
  );
}
