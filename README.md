# COURT · 篮球专项训练 PWA

React + TypeScript + Vite，适配 Windows 与 iPhone。无需账户，所有训练数据只保存在设备的 IndexedDB；应用不含统计分析 SDK 或个人数据上传接口。GitHub Pages 仅提供静态资源。

## Windows 开发

安装 Node.js 24 LTS，再运行 `npm install -g pnpm@11`。进入项目目录：

```powershell
pnpm install
pnpm dev
```

也可双击 `启动训练应用.cmd`。开发地址仅供这台 Windows 使用。验证生产版离线能力：

```powershell
pnpm test
pnpm build
pnpm preview
```

开发模式不注册离线缓存。生产预览 http://127.0.0.1:4173 可以使用 Service Worker。

## 已内置的正式计划

“篮球专项训练”周期包含第 1 周周一／周四、第 2 周周一／周四共 4 个独立模板；严格保留提供的动作、组数、次数与休息时间。杠铃深蹲 65→67.5 kg（第 2 周备注状态良好可 70 kg），卧推 40→42.5 kg。RPE、自重、轻哑铃、单腿／单侧、6–8 次范围和屈膝版本均保留。没有明确负重的动作不预设重量。

开始训练时，固定重量优先采用当周计划；没有给定负重的动作按相同动作 ID 自动填入上次完成组重量。每个动作下方始终显示上次实际完成的各组。杠铃填写含杆总重，哑铃填写单只重量；空白表示自重／未设置。次数按每腿／每侧填写，两侧均完成后勾选一整组。哥本哈根平板用秒记录。重量可手动修改。

每次修改自动保存，包括未完成的训练；同一设备刷新后可以继续。单个设备建议只开一个窗口训练，避免多窗口写入冲突。

## iPhone 安装与离线

1. 在 Safari 中打开 GitHub Pages HTTPS 地址。
2. 点“分享”→“添加到主屏幕”→“添加”。
3. 从主屏幕启动，保持联网，等顶部显示“离线已就绪”。
4. 开启飞行模式后再次打开，确认可以查看计划和记录训练。

应用通过 Workbox 预缓存 HTML、JS、CSS 与 PNG 图标，不依赖外部字体或 CDN。升级提供手动更新提示，避免训练中突然刷新。倒计时保存结束时间，后台暂停 JS 后，回到前台会重算剩余时间；iOS 锁屏后台声音／震动不保证触发，前台显示与声音仍可用。

## JSON 备份与迁移

在“数据与设置”导出完整 JSON，包含计划、历史、草稿与计时状态。恢复前校验应用标识、版本、动作、重量、组数与日期，然后显示覆盖确认。恢复替换全部本地数据，确认前可先备份当前记录。建议每周和升级前备份至“文件”。浏览器清理、卸载、隐私浏览或系统存储回收都可能导致本地数据丢失，持久存储请求不能代替备份。

换手机：旧设备导出 → 将 JSON 保存至“文件”或传到新设备 → 在新设备安装并启动主屏幕应用 → 设置中恢复。Safari 与主屏幕应用的存储环境可能不同，请在最终使用的主屏幕应用中恢复。

计划导入支持 `{ "plans": [...] }` 或计划数组。请先点“导出计划格式”，以该 JSON 为模板修改；同一动作应保持稳定 ID，才能关联历史重量。导入计划不删除历史记录。

力量曲线只使用已结束训练中已完成组的最大实际重量（kg）；单次记录也会显示点。总负荷是完成组的重量 × 次数，哑铃乘 2，标记单侧／腿的动作再乘 2；自重和空白负重计 0，时间动作的自重不计负荷。这是记录口径，不是估算 1RM。

## GitHub Pages

工作流 `.github/workflows/deploy.yml` 在 main 推送后测试、构建并部署。仓库 Settings → Pages → Source 选择 **GitHub Actions**。资源 base 使用 `./`，支持仓库子路径；界面通过内部状态导航，不会出现路由刷新 404。

```powershell
git init -b main
git add .
git commit -m "Build basketball training PWA"
gh repo create basketball-training --public --source . --remote origin --push
```

公开仓库只提交源代码和内置计划，不提交备份、个人训练日志或密钥。托管地址变更会改变浏览器的本地存储来源，变更前先备份。

技术参考：[Vite GitHub Pages 部署](https://vite.dev/guide/static-deploy.html)、[MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)。
