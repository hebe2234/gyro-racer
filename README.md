# 陀螺儀賽車 3D · Gyro Racer 3D

[繁體中文](#繁體中文) | [English](#english)

🎮 **線上遊玩 / Play online**：https://hebe2234.github.io/gyro-racer/

---

## 繁體中文

用手機陀螺儀操控的 3D 賽車遊戲，在真實比例的摩納哥街道賽道上奔馳。

### 玩法

- **轉向**：左右傾斜手機＝轉方向盤（iPhone 首次遊玩會要求陀螺儀權限，請按允許）
- **橫向支援**：橫拿手機時自動改用另一軸感應，反轉方向選項保留
- **油門**：預設自動加速；右下角紅色按鈕＝煞車（過彎用）
- **目標**：無限繞圈，挑戰最速單圈（小地圖＋圈速 HUD）
- 沒有陀螺儀的裝置會自動顯示 ◀ ▶ 觸控轉向鈕；電腦可用 ← → ↑ ↓ 方向鍵
- 介面中英雙語：右上角可隨時切換，會自動偵測系統語言

### 賽道

- 真實摩納哥街道賽道中心線，全長 3.34 公里
- F1 風格賽車、350 公尺隧道、港口與遊艇、看台、金屬護欄、輪胎牆、建築群

### 技術

- Three.js（CDN）全程序化建模，無外部素材
- 賽道：封閉 Catmull-Rom 曲線（centripetal，無自交），長賽道均勻採樣
- 街機式物理：速度／轉向／擦牆減速；賽道約束用中心線投影夾取
- WebAudio 合成引擎聲（隨速度變調），可靜音
- `?autostart=1` 跳過開始畫面（自動測試用）、`?debug=1` 顯示錯誤日誌

### 本機開發

直接用靜態伺服器開啟即可（需連網載入 Three.js CDN）：

```bash
python3 -m http.server 8000
# 瀏覽器開 http://localhost:8000/
```

---

## English

A 3D racing game steered with your phone's gyroscope, on a true-to-scale Monaco street circuit.

### Gameplay

- **Steering**: tilt your phone left/right like a steering wheel (iPhone asks for gyroscope permission on first play — tap Allow)
- **Landscape support**: automatically switches sensing axis when held sideways; invert-steering option kept
- **Throttle**: auto-accelerate by default; red button bottom-right = brake (for corners)
- **Goal**: endless laps, chase your best lap time (minimap + lap-time HUD)
- Devices without a gyroscope get ◀ ▶ touch-steer buttons; on desktop use ← → ↑ ↓ arrow keys
- Bilingual UI (Traditional Chinese / English): switch anytime from the top-right button, auto-detects system language

### Track

- Real Monaco street-circuit centerline, 3.34 km
- F1-style car, 350 m tunnel, harbor with yachts, grandstands, guardrails, tire walls, city buildings

### Tech

- Three.js (CDN), fully procedural modeling, no external assets
- Track: closed Catmull-Rom curve (centripetal, no self-intersection) with even long-track sampling
- Arcade physics: speed / steering / wall-scrape slowdown; track constraint via centerline projection clamping
- WebAudio synthesized engine sound (pitch follows speed), mutable
- `?autostart=1` skips the start screen (for automated testing), `?debug=1` shows the error log

### Local dev

Just serve it statically (needs internet for the Three.js CDN):

```bash
python3 -m http.server 8000
# open http://localhost:8000/ in your browser
```
