# VNPT BMAD Custom Bundle for BMAD 6.2.0 + OpenCode

Bộ này gom các customizations, workflows, skills, commands, agent templates và installer để dựng nhanh môi trường BMAD 6.2.0 + OpenCode theo chuẩn VNPT.

## Thành phần chính

### 1) BMAD agent customizations
- `bmad-dev-custom`: gói compatibility/guardrails cho `bmm-dev`. Giữ lại để tương thích và áp policy skill theo stack, nhưng **không còn được xem là entrypoint chính** cho việc dev story ở BMAD 6.2.0.
- `bmad-ux-designer-custom`: customize `bmm-ux-designer` để làm việc tốt với `ui-ux-pro-max`.
- `bmad-architect-custom`: customize `bmm-architect`, bổ sung định hướng architecture-as-code và workflow kiến trúc.

### 2) Workflow commands bổ sung
- `bmad-create-ui-design-concept`: command/skill để tạo UI design concept toàn cục.
- `bmad-create-data-architecture`: command/skill để tạo data architecture theo tài liệu BMAD hiện có.

### 3) Bộ kỹ năng phát triển theo stack
Các package dưới đây đều được installer copy sang `.opencode/skills/` và `.opencode/commands/` trong repo đích.

- `bmad-vnpt-web-react`: frontend React
- `bmad-vnpt-web-angular`: frontend Angular
- `bmad-vnpt-web-vue`: frontend Vue
- `bmad-vnpt-mobile-react`: mobile React Native
- `bmad-vnpt-mobile-flutter`: mobile Flutter
- `bmad-vnpt-dotnet`: backend C# / .NET
- `bmad-vnpt-python`: Python cho AI/ML, web, desktop, scripts/tools
- `bmad-vnpt-c-cpp`: C/C++
- `bmad-vnpt-devops`: DevOps / CI/CD / IaC / Kubernetes
- `bmad-vnpt-golang`: Go backend
- `bmad-vnpt-java-springboot`: Java Spring Boot backend
- `bmad-vnpt-nodejs`: Node.js backend
- `bmad-vnpt-php`: PHP
- `bmad-vnpt-deep-review`: deep review workflow
- `bmad-vnpt-security`: security review tổng quát
- `bmad-vnpt-security-api`
- `bmad-vnpt-security-appsec`
- `bmad-vnpt-security-auth`
- `bmad-vnpt-security-c-cpp`
- `bmad-vnpt-security-cloud-k8s`
- `bmad-vnpt-security-compliance`
- `bmad-vnpt-security-devsecops`
- `bmad-vnpt-security-dotnet`
- `bmad-vnpt-security-frontend-angular`
- `bmad-vnpt-security-frontend-react`
- `bmad-vnpt-security-frontend-vue`
- `bmad-vnpt-security-go`
- `bmad-vnpt-security-java-spring`
- `bmad-vnpt-security-mobile-flutter`
- `bmad-vnpt-security-mobile-react`
- `bmad-vnpt-security-nodejs`
- `bmad-vnpt-security-php`
- `bmad-vnpt-security-python`

### 4) UI/UX skill ngoài bundle
- `ui-ux-pro-max`: được clone trực tiếp từ upstream GitHub vào `.opencode/skills/ui-ux-pro-max`.

### 5) Story-first implementation orchestrator mới
Thư mục `vnpt-dev-story-orchestrator` bổ sung entrypoint mới cho việc phát triển story theo đúng hướng BMAD 6.2.0 skill-first:

- Command: `vnpt-dev-story-loop`
- Primary agent: `vnpt-dev-story-orchestrator`
- Implementation subagent: `vnpt-story-implementer`
- Workflow bắt buộc: `bmad-dev-story`

Mục tiêu là lấy `bmad-dev-story` làm lõi implementation cho từng story, fan-out nhiều subagent theo từng bounded slice, sau đó mới chuyển sang quality gate review.

### 6) Review orchestrator mới
Thư mục `vnpt-review-orchestrator` bổ sung một vòng lặp review/fix nhiều sub-agent cho OpenCode:

- Command: `vnpt-review-loop`
- Primary agent: `vnpt-review-orchestrator`
- Review subagent: `vnpt-review-auditor`
- Fix subagent: `vnpt-fix-worker`

Mục tiêu là fan-out review song song, gom findings, fan-out fix song song, validate, rồi re-review/re-fix lặp lại cho tới khi không còn actionable issues.

## Installer

Chạy file:

```bash
python install_vnpt_bmad_custom_all.py --repo /path/to/your/repo
```

Installer hiện sẽ:
- cài BMAD 6.2.0 vào repo đích
- copy các BMAD custom agent configs
- cài `ui-ux-pro-max`
- cài skill `bmad-vnpt-java-springboot`
- copy toàn bộ commands/skills/workflows của các package `bmad-vnpt-*`
- copy story-first dev orchestrator command + agents mới
- copy review orchestrator command + agents mới
- copy cấu hình OpenCode global từ `opencode_config`
- cài Serena và cập nhật `serena_config.yml`
- thử cài GitNexus
- kiểm tra lại các file đã được cài đặt

## Kết quả trong repo đích

Sau khi cài, repo đích sẽ có tối thiểu các thư mục quan trọng:
- `.opencode/skills/`
- `.opencode/commands/`
- `.opencode/agents/`
- `_bmad/_config/agents/`
- `docs/`

## Gợi ý dùng review orchestrator

Trong OpenCode, chạy:

```text
/vnpt-review-loop
```

Hoặc giới hạn phạm vi:

```text
/vnpt-review-loop src/
```

Ngoài command và agents, installer cũng copy thêm file tham khảo cấu hình:
- `.opencode/opencode.review-orchestrator.jsonc.example`
- `docs/vnpt-review-orchestrator.README.md`

## Review quality gate

Sau khi dev story hoặc coding task hoàn tất, agent nên chạy quality gate bằng command:

```
/vnpt-review-loop
```

hoặc scope cụ thể hơn:

```
/vnpt-review-loop src/
```

Mục tiêu là ép vòng lặp review -> fix -> validate -> re-review cho tới khi pass review mới nhất không còn actionable issues. Trong `bmm-dev.customize.yaml`, policy này đã được bổ sung để tránh agent dừng ở mức “code xong nhưng chưa qua quality gate”.


## Entry point nên dùng hiện tại

Với BMAD 6.2.0, hướng nên dùng để dev feature/story là:

```text
/vnpt-dev-story-loop docs/stories/<story-file>.md
```

Flow mục tiêu:
1. `vnpt-dev-story-loop` đọc story và tài liệu liên quan.
2. Orchestrator bắt buộc dùng `bmad-dev-story` làm workflow implementation.
3. Orchestrator spawn nhiều `vnpt-story-implementer` theo bounded slice.
4. Sau khi merge và validate, orchestrator chạy `/vnpt-review-loop`.
5. Chỉ khi review loop sạch hoàn toàn mới được coi là hoàn tất story.

Điều này phản ánh đúng hơn cách BMAD 6.2.0 đang vận hành theo hướng **story-first** và **skill-first**, thay vì phụ thuộc vào `bmm-dev` như entrypoint chính.
