# 参考视频上传入口

把要解析的参考视频（.mp4 / .mov / .webm）或竞品单文件 playable（.html）放进这个目录并提交，
然后在 Claude Code 会话中运行：

```
/video-to-design reference/incoming/<文件名>
```

也可以直接给视频链接（直链 mp4 或 YouTube/B 站等平台链接），命令会自动下载到本目录再解析：

```
/video-to-design https://<视频链接>
```

解析完成后会生成 `docs/design/<名称>.md` 策划案。接着运行：

```
/design-to-playable docs/design/<名称>.md
```

即可让 agent 按策划案在本工程中选择模板、填入配置并产出可运行的 Cocos playable。

> 提示：如果会话环境无法安装 ffmpeg 抽帧，可以直接把视频的关键截图（每 1-2 秒一张）
> 放到 `reference/incoming/<名称>-frames/` 目录，命令会自动使用截图分析。
