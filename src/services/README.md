# Services (业务逻辑层)

**职责**：
- 系统的大脑，进行所有纯无状态的数据处理和业务判定。
- 从 `models` 接收参数，并向 `infrastructure` 请求所需的数据。
- **严禁**：主动挂载 CLI UI，或直接耦合具体的底层库（如 axios）。如果需要发网路请求，必须调用 `infrastructure` 层。
