export const WEB_UI_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🛰️ tnx-tool-tv - 智能网关与直投控制台</title>
    <!-- 引入 Google Fonts Outfit & Noto Sans SC -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <!-- 引入 FontAwesome 图标 -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- 引入 mpegts.js 播放器 -->
    <script src="https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js"></script>

    <style>
        :root {
            --bg-base: #0a0d14;
            --bg-surface: rgba(20, 24, 38, 0.65);
            --bg-surface-hover: rgba(30, 37, 58, 0.8);
            --bg-card: rgba(13, 17, 28, 0.9);
            
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --text-muted: #6b7280;

            --color-primary: #6366f1; /* 极客靛蓝 */
            --color-primary-glow: rgba(99, 102, 241, 0.4);
            --color-secondary: #06b6d4; /* 霓虹青 */
            --color-accent: #ec4899; /* 霓虹粉 */
            --color-success: #10b981; /* 活力绿 */
            --color-warning: #f59e0b; /* 警告黄 */
            --color-error: #ef4444; /* 错误红 */

            --border-color: rgba(255, 255, 255, 0.08);
            --border-glow: rgba(99, 102, 241, 0.15);
            
            --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', 'Noto Sans SC', sans-serif;
            background-color: var(--bg-base);
            color: var(--text-primary);
            height: 100vh;
            overflow: hidden;
            display: flex;
            background-image: 
                radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(6, 182, 212, 0.1) 0px, transparent 50%);
        }

        /* 侧边栏样式 */
        .sidebar {
            width: 340px;
            background-color: rgba(10, 13, 20, 0.8);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            backdrop-filter: blur(20px);
            z-index: 10;
        }

        .sidebar-header {
            padding: 24px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .sidebar-header i {
            font-size: 24px;
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .sidebar-header h1 {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .search-container {
            padding: 16px 24px 8px 24px;
            position: relative;
        }

        .search-input {
            width: 100%;
            padding: 12px 16px 12px 42px;
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
            transition: var(--transition-smooth);
        }

        .search-input:focus {
            outline: none;
            border-color: var(--color-primary);
            box-shadow: 0 0 12px var(--color-primary-glow);
            background-color: rgba(255, 255, 255, 0.08);
        }

        .search-container i {
            position: absolute;
            left: 38px;
            top: 26px;
            color: var(--text-muted);
        }

        .tabs {
            display: flex;
            padding: 8px 24px;
            gap: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        .tab-btn {
            flex: 1;
            padding: 8px 4px;
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border-radius: 8px;
            transition: var(--transition-smooth);
        }

        .tab-btn:hover {
            background-color: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
        }

        .tab-btn.active {
            background-color: var(--color-primary);
            color: white;
            box-shadow: 0 4px 12px var(--color-primary-glow);
        }

        .channel-list {
            flex: 1;
            overflow-y: auto;
            padding: 16px 24px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        /* 自定义滚动条 */
        ::-webkit-scrollbar {
            width: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .channel-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            background-color: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            cursor: pointer;
            transition: var(--transition-smooth);
        }

        .channel-item:hover {
            background-color: var(--bg-surface-hover);
            transform: translateY(-2px);
            border-color: var(--color-primary-glow);
        }

        .channel-item.playing {
            background-color: rgba(99, 102, 241, 0.15);
            border-color: var(--color-primary);
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.1);
        }

        .channel-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .channel-avatar {
            width: 38px;
            height: 38px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
            border: 1px solid var(--border-color);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 700;
            color: var(--color-secondary);
        }

        .channel-item.playing .channel-avatar {
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
            color: white;
            border-color: transparent;
        }

        .channel-details {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .channel-name {
            font-size: 14px;
            font-weight: 600;
            max-width: 160px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .channel-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 6px;
            font-weight: 700;
            align-self: flex-start;
        }

        .badge-active {
            background-color: rgba(16, 185, 129, 0.15);
            color: var(--color-success);
        }

        .badge-inactive {
            background-color: rgba(255, 255, 255, 0.05);
            color: var(--text-muted);
        }

        .channel-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .action-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 14px;
            padding: 6px;
            border-radius: 8px;
            transition: var(--transition-smooth);
        }

        .action-btn:hover {
            color: var(--text-primary);
            background-color: rgba(255, 255, 255, 0.08);
        }

        .action-btn.fav.active {
            color: var(--color-warning);
        }

        .action-btn.cast:hover {
            color: var(--color-secondary);
        }

        /* 主体内容区域 */
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* 顶部导航 */
        .navbar {
            height: 72px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 32px;
            background-color: rgba(10, 13, 20, 0.4);
            backdrop-filter: blur(10px);
        }

        .navbar-status {
            display: flex;
            align-items: center;
            gap: 20px;
            font-size: 14px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background-color: var(--color-success);
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 8px var(--color-success);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .navbar-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .nav-btn {
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 8px 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: var(--transition-smooth);
        }

        .nav-btn:hover {
            background-color: rgba(255, 255, 255, 0.08);
            border-color: var(--color-primary-glow);
        }

        .nav-btn.primary {
            background-color: var(--color-primary);
            border-color: transparent;
            box-shadow: 0 4px 12px var(--color-primary-glow);
        }

        .nav-btn.primary:hover {
            background-color: #4f46e5;
            box-shadow: 0 4px 20px var(--color-primary-glow);
        }

        /* 核心布局 */
        .dashboard-body {
            flex: 1;
            padding: 24px 32px;
            display: grid;
            grid-template-columns: 1.5fr 1fr;
            grid-template-rows: auto 1fr;
            gap: 24px;
            overflow-y: auto;
        }

        /* 播放器容器 */
        .player-card {
            grid-column: 1 / 2;
            grid-row: 1 / 3;
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(30px);
        }

        .player-header {
            padding: 16px 24px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .player-title {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .player-title h2 {
            font-size: 16px;
            font-weight: 700;
        }

        .player-viewport {
            flex: 1;
            background-color: #000;
            position: relative;
            aspect-ratio: 16 / 9;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .player-viewport video {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .player-placeholder {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: #07090f;
            color: var(--text-muted);
            gap: 16px;
            z-index: 2;
        }

        .player-placeholder i {
            font-size: 56px;
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .player-placeholder p {
            font-size: 14px;
            max-width: 280px;
            text-align: center;
            line-height: 1.6;
        }

        .player-controls {
            padding: 16px 24px;
            border-top: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .player-cast-bar {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        /* 系统面板 */
        .status-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 18px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(30px);
        }

        .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .card-header h3 {
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: var(--text-secondary);
        }

        .metric-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }

        .metric-box {
            background-color: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .metric-title {
            font-size: 12px;
            color: var(--text-muted);
            font-weight: 500;
        }

        .metric-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--color-secondary);
            font-family: 'Outfit', sans-serif;
        }

        /* 遥控器面板 */
        .remote-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(30px);
            align-items: center;
        }

        .remote-layout {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            width: 100%;
            max-width: 220px;
        }

        .dpad {
            position: relative;
            width: 160px;
            height: 160px;
            background-color: rgba(255, 255, 255, 0.03);
            border: 2px solid var(--border-color);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .dpad-btn {
            position: absolute;
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            transition: var(--transition-smooth);
        }

        .dpad-btn:hover {
            background-color: rgba(255, 255, 255, 0.08);
            color: var(--color-primary);
        }

        .dpad-btn:active {
            transform: scale(0.9);
            background-color: var(--color-primary);
            color: white;
            box-shadow: 0 0 15px var(--color-primary-glow);
        }

        .dpad-up { top: 6px; }
        .dpad-down { bottom: 6px; }
        .dpad-left { left: 6px; }
        .dpad-right { right: 6px; }

        .dpad-ok {
            position: relative;
            width: 60px;
            height: 60px;
            background-color: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 50%;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: var(--text-primary);
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            transition: var(--transition-smooth);
        }

        .dpad-ok:hover {
            background-color: var(--bg-surface-hover);
            border-color: var(--color-primary-glow);
        }

        .dpad-ok:active {
            transform: scale(0.95);
            background-color: var(--color-primary);
            color: white;
            box-shadow: 0 0 15px var(--color-primary-glow);
        }

        .remote-row {
            display: flex;
            justify-content: space-between;
            width: 100%;
            gap: 12px;
        }

        .remote-btn {
            flex: 1;
            padding: 12px;
            background-color: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: var(--transition-smooth);
        }

        .remote-btn:hover {
            background-color: rgba(255, 255, 255, 0.08);
            color: var(--text-primary);
            border-color: var(--border-glow);
        }

        .remote-btn:active {
            transform: scale(0.95);
            background-color: rgba(255, 255, 255, 0.12);
        }

        .remote-btn.danger:hover {
            color: var(--color-error);
            border-color: rgba(239, 68, 68, 0.2);
            background-color: rgba(239, 68, 68, 0.08);
        }

        /* 吐司通知 */
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background-color: var(--bg-card);
            border: 1px solid var(--color-primary);
            box-shadow: 0 8px 24px rgba(99, 102, 241, 0.2);
            color: var(--text-primary);
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 1000;
            transform: translateY(100px);
            opacity: 0;
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease;
        }

        .toast.show {
            transform: translateY(0);
            opacity: 1;
        }
    </style>
</head>
<body>

    <!-- 侧边栏 -->
    <div class="sidebar">
        <div class="sidebar-header">
            <i class="fa-solid fa-satellite-dish"></i>
            <h1>tnx-tool-tv</h1>
        </div>

        <div class="search-container">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="searchInput" class="search-input" placeholder="输入频道名称搜索...">
        </div>

        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('all')">全部</button>
            <button class="tab-btn" onclick="switchTab('active')">活跃</button>
            <button class="tab-btn" onclick="switchTab('fav')">收藏</button>
        </div>

        <div class="channel-list" id="channelList">
            <!-- 动态渲染 -->
        </div>
    </div>

    <!-- 主体区域 -->
    <div class="main-content">
        <!-- 顶部状态栏 -->
        <div class="navbar">
            <div class="navbar-status">
                <span class="status-dot"></span>
                <span>网关运行中</span>
                <span style="color: var(--text-muted);">|</span>
                <span id="activeChannelText">无活跃流</span>
            </div>
            <div class="navbar-actions">
                <button class="nav-btn" onclick="refreshAll()">
                    <i class="fa-solid fa-arrows-rotate"></i> 刷新数据
                </button>
                <a href="/playlist.m3u" target="_blank" class="nav-btn primary" style="text-decoration: none;">
                    <i class="fa-solid fa-list"></i> 获取播放列表
                </a>
            </div>
        </div>

        <!-- Dashboard 主体 -->
        <div class="dashboard-body">
            <!-- 播放器卡片 -->
            <div class="player-card">
                <div class="player-header">
                    <div class="player-title">
                        <i class="fa-solid fa-circle-play" style="color: var(--color-primary);"></i>
                        <h2 id="currentPlayerName">未选择频道</h2>
                    </div>
                    <div id="playingBadge" class="channel-badge badge-inactive">STOPPED</div>
                </div>

                <div class="player-viewport">
                    <!-- 占位提示 -->
                    <div class="player-placeholder" id="playerPlaceholder">
                        <i class="fa-solid fa-tv"></i>
                        <p>请在左侧频道列表中选择一个频道进行本地解码播放，或点击直投按钮投送至电视机。</p>
                    </div>
                    <video id="videoPlayer" controls></video>
                </div>

                <div class="player-controls">
                    <div class="player-cast-bar">
                        <button class="nav-btn" id="castBtn" onclick="castCurrent()" disabled>
                            <i class="fa-solid fa-tv"></i> 直投当前频道至电视
                        </button>
                    </div>
                    <span id="streamLatency" style="font-size: 13px; color: var(--text-muted);">
                        播放协议: MPEG-TS over HTTP (MSE)
                    </span>
                </div>
            </div>

            <!-- 系统健康面板 -->
            <div class="status-card">
                <div class="card-header">
                    <h3>网关监控看板</h3>
                    <i class="fa-solid fa-chart-line" style="color: var(--color-secondary);"></i>
                </div>
                <div class="metric-grid">
                    <div class="metric-box">
                        <span class="metric-title">活跃标签数 (Playwright)</span>
                        <span class="metric-value" id="statusActiveTabs">0</span>
                    </div>
                    <div class="metric-box">
                        <span class="metric-title">共享浏览器内存</span>
                        <span class="metric-value" id="statusMemory">0.0 MB</span>
                    </div>
                    <div class="metric-box">
                        <span class="metric-title">并发接收端 (Viewer)</span>
                        <span class="metric-value" id="statusViewers">0</span>
                    </div>
                    <div class="metric-box">
                        <span class="metric-title">电视直投目标 IP</span>
                        <span class="metric-value" id="statusTvIp" style="font-size: 16px;">未配置</span>
                    </div>
                </div>
            </div>

            <!-- 电视虚拟遥控器 -->
            <div class="remote-card">
                <div class="card-header" style="width: 100%;">
                    <h3>局域网电视遥控器</h3>
                    <i class="fa-solid fa-gamepad" style="color: var(--color-accent);"></i>
                </div>
                
                <div class="remote-layout">
                    <div class="remote-row">
                        <button class="remote-btn danger" onclick="sendRemoteKey('power')">
                            <i class="fa-solid fa-power-off"></i> 电源
                        </button>
                        <button class="remote-btn" onclick="sendRemoteKey('menu')">
                            菜单
                        </button>
                    </div>

                    <!-- 方向键 D-Pad -->
                    <div class="dpad">
                        <button class="dpad-btn dpad-up" onclick="sendRemoteKey('up')" title="上">
                            <i class="fa-solid fa-caret-up"></i>
                        </button>
                        <button class="dpad-btn dpad-down" onclick="sendRemoteKey('down')" title="下">
                            <i class="fa-solid fa-caret-down"></i>
                        </button>
                        <button class="dpad-btn dpad-left" onclick="sendRemoteKey('left')" title="左">
                            <i class="fa-solid fa-caret-left"></i>
                        </button>
                        <button class="dpad-btn dpad-right" onclick="sendRemoteKey('right')" title="右">
                            <i class="fa-solid fa-caret-right"></i>
                        </button>
                        <button class="dpad-ok" onclick="sendRemoteKey('ok')">OK</button>
                    </div>

                    <div class="remote-row">
                        <button class="remote-btn" onclick="sendRemoteKey('back')">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 返回
                        </button>
                        <button class="remote-btn" onclick="sendRemoteKey('home')">
                            <i class="fa-solid fa-house"></i> 主页
                        </button>
                    </div>

                    <div class="remote-row">
                        <button class="remote-btn" onclick="sendRemoteKey('volumedown')" title="音量减">
                            <i class="fa-solid fa-volume-low"></i>
                        </button>
                        <button class="remote-btn" onclick="sendRemoteKey('volumeup')" title="音量加">
                            <i class="fa-solid fa-volume-high"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- 弹窗通知 -->
    <div class="toast" id="toast">
        <i class="fa-solid fa-circle-info"></i>
        <span id="toastText">操作成功</span>
    </div>

    <script>
        let allChannels = [];
        let activeTab = 'all';
        let currentPlayingPid = null;
        let mpegtsPlayer = null;
        const videoElement = document.getElementById('videoPlayer');

        // 收藏夹逻辑 (LocalStorage)
        function getFavorites() {
            const favs = localStorage.getItem('tnx_fav_channels');
            return favs ? JSON.parse(favs) : [];
        }

        function toggleFavorite(pid, event) {
            event.stopPropagation();
            let favs = getFavorites();
            if (favs.includes(pid)) {
                favs = favs.filter(id => id !== pid);
                showToast('已取消收藏');
            } else {
                favs.push(pid);
                showToast('已加入收藏');
            }
            localStorage.setItem('tnx_fav_channels', JSON.stringify(favs));
            renderChannels();
        }

        // 吐司提示
        function showToast(text, isError = false) {
            const toast = document.getElementById('toast');
            const toastText = document.getElementById('toastText');
            toastText.innerText = text;
            
            if (isError) {
                toast.style.borderColor = 'var(--color-error)';
                toast.style.boxShadow = '0 8px 24px rgba(239, 68, 68, 0.2)';
            } else {
                toast.style.borderColor = 'var(--color-primary)';
                toast.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.2)';
            }

            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // 切换选项卡
        function switchTab(tab) {
            activeTab = tab;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            event.currentTarget.classList.add('active');
            renderChannels();
        }

        // 获取并刷新数据
        async function refreshAll() {
            try {
                const [channelsRes, statusRes] = await Promise.all([
                    fetch('/api/channels'),
                    fetch('/api/status')
                ]);
                
                if (channelsRes.ok) {
                    allChannels = await channelsRes.json();
                    renderChannels();
                }
                
                if (statusRes.ok) {
                    const status = await statusRes.json();
                    updateStatusPanel(status);
                }
            } catch (err) {
                console.error("刷新网关状态失败:", err);
                showToast("连接网关 API 失败，请检查网络", true);
            }
        }

        // 更新健康面板
        function updateStatusPanel(status) {
            document.getElementById('statusActiveTabs').innerText = status.activeTabs;
            document.getElementById('statusMemory').innerText = status.browserMemory;
            document.getElementById('statusViewers').innerText = status.activeChannelsCount;
            document.getElementById('statusTvIp').innerText = status.tvIp || "未配置";
            
            // 顶部小文字状态
            const activeText = status.activeChannelsCount > 0 
                ? '活跃流通道: ' + status.activeChannelsCount + ' 个' 
                : '无活跃流';
            document.getElementById('activeChannelText').innerText = activeText;
        }

        // 渲染频道列表
        function renderChannels() {
            const listContainer = document.getElementById('channelList');
            const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
            const favorites = getFavorites();

            // 过滤
            let filtered = allChannels.filter(ch => {
                const matchesSearch = ch.name.toLowerCase().includes(searchVal);
                if (!matchesSearch) return false;

                if (activeTab === 'active') return ch.active;
                if (activeTab === 'fav') return favorites.includes(ch.pid);
                return true;
            });

            // 排序：收藏的排前面，活跃的排前面
            filtered.sort((a, b) => {
                const aFav = favorites.includes(a.pid) ? 1 : 0;
                const bFav = favorites.includes(b.pid) ? 1 : 0;
                if (aFav !== bFav) return bFav - aFav;

                const aAct = a.active ? 1 : 0;
                const bAct = b.active ? 1 : 0;
                return bAct - aAct;
            });

            if (filtered.length === 0) {
                listContainer.innerHTML = \`<div style="text-align: center; color: var(--text-muted); padding: 30px 10px; font-size: 13px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    暂无频道匹配
                </div>\`;
                return;
            }

            listContainer.innerHTML = filtered.map(ch => {
                const isPlaying = ch.pid === currentPlayingPid;
                const isFav = favorites.includes(ch.pid);
                const firstChar = ch.name.charAt(0);
                
                return \`
                    <div class="channel-item \${isPlaying ? 'playing' : ''}" onclick="selectChannel('\${ch.pid}', '\${ch.name}')">
                        <div class="channel-info">
                            <div class="channel-avatar">\${firstChar}</div>
                            <div class="channel-details">
                                <div class="channel-name" title="\${ch.name}">\${ch.name}</div>
                                \${ch.active 
                                    ? \`<span class="channel-badge badge-active"><i class="fa-solid fa-signal"></i> 活跃 (\${ch.viewers}人)</span>\`
                                    : \`<span class="channel-badge badge-inactive">空闲</span>\`
                                }
                            </div>
                        </div>
                        <div class="channel-actions">
                            <button class="action-btn fav \${isFav ? 'active' : ''}" onclick="toggleFavorite('\${ch.pid}', event)" title="收藏">
                                <i class="fa-\${isFav ? 'solid' : 'regular'} fa-star"></i>
                            </button>
                            <button class="action-btn cast" onclick="castChannel('\${ch.pid}', event)" title="直投到电视">
                                <i class="fa-solid fa-tv"></i>
                            </button>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        // 选择并播放频道
        function selectChannel(pid, name) {
            if (currentPlayingPid === pid) return;
            
            currentPlayingPid = pid;
            document.getElementById('currentPlayerName').innerText = name;
            document.getElementById('playingBadge').innerText = 'DECODING';
            document.getElementById('playingBadge').className = 'channel-badge badge-active';
            
            // 隐藏占位图
            document.getElementById('playerPlaceholder').style.display = 'none';

            // 启用投屏按钮
            document.getElementById('castBtn').removeAttribute('disabled');
            document.getElementById('castBtn').className = 'nav-btn primary';

            // 重新挂载播放器
            destroyPlayer();
            initPlayer(pid);
            renderChannels();
        }

        // 初始化 mpegts 播放器
        function initPlayer(pid) {
            if (!mpegts.isSupported()) {
                showToast("当前浏览器不支持 MediaSource 播放", true);
                return;
            }

            const streamUrl = window.location.origin + '/live?pid=' + pid;
            
            mpegtsPlayer = mpegts.createPlayer({
                type: 'mpegts',
                isLive: true,
                url: streamUrl,
                enableWorker: true,
                lazyLoad: true,
                lazyLoadMaxKeepDuration: 12,
                lazyLoadRecoverDuration: 3
            }, {
                enableStashBuffer: true,
                stashInitialSize: 512 * 1024, // 512KB 初始缓冲，平滑抖动
                liveBufferLatencyChasing: false, // 电视直播流畅优先，关闭激进追赶
                liveBufferLatencyMaxLimit: 6.0,
                liveBufferLatencyMinLimit: 2.0
            });

            mpegtsPlayer.attachMediaElement(videoElement);
            
            mpegtsPlayer.on(mpegts.Events.ERROR, (type, detail, info) => {
                console.error("播放器出错:", type, detail, info);
                document.getElementById('playingBadge').innerText = 'ERROR';
                document.getElementById('playingBadge').className = 'channel-badge';
                document.getElementById('playingBadge').style.backgroundColor = 'var(--color-error)';
            });

            try {
                mpegtsPlayer.load();
                mpegtsPlayer.play().catch(err => {
                    console.warn("自动起播被浏览器策略拦截:", err.message);
                });
            } catch (e) {
                console.error("加载流失败:", e);
            }
        }

        // 销毁播放器
        function destroyPlayer() {
            if (mpegtsPlayer) {
                try {
                    mpegtsPlayer.pause();
                    mpegtsPlayer.unload();
                    mpegtsPlayer.detachMediaElement();
                    mpegtsPlayer.destroy();
                } catch (e) {
                    console.error("销毁播放器出错:", e);
                }
                mpegtsPlayer = null;
            }
        }

        // 投屏指定频道
        async function castChannel(pid, event) {
            if (event) event.stopPropagation();
            showToast("正在投送指令到电视...");
            try {
                const res = await fetch('/api/cast?pid=' + pid, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast("投屏指令已发送，电视端载入中");
                } else {
                    showToast("投屏失败: " + (data.error || "未知原因"), true);
                }
            } catch (e) {
                showToast("投屏接口调用失败", true);
            }
        }

        // 投屏当前播放频道
        function castCurrent() {
            if (currentPlayingPid) {
                castChannel(currentPlayingPid);
            }
        }

        // 发送遥控按键
        async function sendRemoteKey(key) {
            try {
                const res = await fetch('/api/remote/key?key=' + key, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    // 按钮点击动效微交互，这里可通过 toast 轻微显示
                } else {
                    showToast("遥控按键发送失败: " + (data.error || "电视未连接"), true);
                }
            } catch (e) {
                showToast("遥控按键接口连接失败", true);
            }
        }

        // 搜索事件
        document.getElementById('searchInput').addEventListener('input', renderChannels);

        // 初始化
        refreshAll();
        
        // 每 3.5 秒自动更新一次监控健康状态
        setInterval(async () => {
            try {
                const statusRes = await fetch('/api/status');
                if (statusRes.ok) {
                    const status = await statusRes.json();
                    updateStatusPanel(status);
                }
                
                // 顺便轻量级刷新频道状态（比如查看活跃度改变）
                const channelsRes = await fetch('/api/channels');
                if (channelsRes.ok) {
                    allChannels = await channelsRes.json();
                    renderChannels();
                }
            } catch (err) {
                console.warn("轮询后台状态失败，可能网络波动");
            }
        }, 3500);

        // 离开页面前清理资源
        window.addEventListener('beforeunload', () => {
            destroyPlayer();
        });
    </script>
</body>
</html>`;
