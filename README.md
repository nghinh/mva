# VNPT Custom BMAD

Bộ `vnpt-bmad-custom` là một lớp mở rộng được tổ chức lại để dùng chung với **BMAD v6.2.0**, **OpenCode**, và **oh-my-opencode**, nhằm biến BMAD thành một quy trình phát triển phần mềm có tính cưỡng chế cao hơn, nhất quán hơn, và phù hợp hơn với các dự án thực tế có cả frontend, backend và kiến trúc hệ thống.

Tài liệu này mô tả:
- mục tiêu của bộ custom
- các thành phần đã được xây dựng
- các integration và customize đã thêm vào BMAD
- cấu trúc thư mục của bundle
- cách cài đặt tổng thể chỉ với một script duy nhất
- kết quả mong đợi sau khi cài đặt

---

## 1. Mục tiêu của bộ custom này

Mục tiêu chính của `vnpt-bmad-custom` là:

1. Giữ nguyên triết lý và workflow cốt lõi của **BMAD v6.2.0**
2. Tăng cường hành vi của các agent/workflow hiện có bằng các **customize** và **skill** bổ sung
3. Tích hợp thêm các skill cộng đồng hoặc skill nội bộ để agent tự động sử dụng đúng ngữ cảnh
4. Chuẩn hóa cách làm việc trong OpenCode để:
   - frontend luôn bám UX/UI artifacts
   - backend Java luôn bám Spring Boot conventions/patterns
   - kiến trúc hệ thống được phân tích sâu hơn và có Architecture-as-Code
   - OMO được dùng như một execution layer mạnh hơn cho dev-story khi cần

Nói ngắn gọn:

- **BMAD** giữ vai trò **process authority**
- **OpenCode** là môi trường AI IDE chính
- **oh-my-opencode / OMO** là lớp tăng cường execution
- các **custom skills** được nạp tự động theo loại công việc

---

## 2. Những gì đã được xây dựng

Bộ custom hiện tại gồm các khối chính sau.

### 2.1. `bmad-omo-integration`
Khối này dùng để tích hợp lớp OMO vào BMAD.

Mục đích:
- bổ sung workflow `bmad-dev-story-omo`
- thêm OpenCode command/skill tương ứng
- đồng bộ docs của BMAD sang `AGENTS.md`
- hỗ trợ execution flow mạnh hơn khi cần triển khai story phức tạp

Vai trò:
- không thay thế BMAD
- không thay thế `bmad-dev-story`
- chỉ bổ sung một đường execution tăng cường

---

### 2.2. `bmad-ui-design-concept`
Khối này bổ sung một workflow mới:

- `bmad-create-ui-design-concept`

Mục đích:
- tạo ra **1 file HTML duy nhất** mô tả concept UI tổng thể của sản phẩm
- dùng để trình duyệt/phê duyệt trước khi đi vào code chi tiết
- giúp frontend implementation bám đúng định hướng UX/UI đã chốt

Output chính:
- `docs/ui-design/product-concept.html`

---

### 2.3. `bmad-dev-custom`
Đây là phần customize cho `bmm-dev`.

Mục đích:
- giữ nguyên agent dev mặc định của BMAD
- tăng cường hành vi của agent theo loại task

Các rule chính:
- nếu task là **frontend/UI**, agent phải:
  - load skill `ui-ux-pro-max`
  - đọc `docs/ux-design.md`
  - đọc `docs/ui-design/product-concept.html`
- nếu task là **backend Java / Spring Boot**, agent phải:
  - load skill `springboot-patterns`
  - áp dụng đúng conventions/patterns của skill Java Spring Boot

Nhờ đó:
- frontend code bám thiết kế
- backend code bám chuẩn Spring Boot
- không cần prompt inject thủ công mỗi lần

---

### 2.4. `bmad-ux-designer-custom`
Đây là phần customize cho `bmm-ux-designer`.

Mục đích:
- giữ nguyên workflow UX mặc định của BMAD
- nhưng cưỡng chế UX designer luôn load và sử dụng skill `ui-ux-pro-max`

Như vậy:
- bạn vẫn dùng workflow chuẩn của BMAD
- nhưng chất lượng tài liệu UX được tăng cường nhờ skill bên ngoài
- không cần tự nhắc agent load skill bằng prompt tay

---

### 2.5. `bmad-architect-custom`
Đây là phần customize cho `bmm-architect`.

Mục đích:
- làm cho architect agent của BMAD kế thừa thêm tư duy của `engineering-software-architect`
- tăng chiều sâu phân tích kiến trúc
- ép tạo thêm **Architecture-as-Code** bằng **LikeC4**

Các rule chính:
- phân tích domain trước công nghệ
- trade-off rõ ràng
- tránh architecture overengineering
- ghi quyết định dưới dạng ADR
- luôn sinh các file LikeC4 cho đủ 3 layer:
  - `docs/architecture/likec4/context.likec4`
  - `docs/architecture/likec4/container.likec4`
  - `docs/architecture/likec4/component.likec4`
- tài liệu architecture markdown phải link tới các file LikeC4 này để tham chiếu

---

### 2.6. `opencode_config`
Đây là thư mục chứa cấu hình global cho OpenCode / oh-my-opencode.

Bao gồm:
- `opencode.json`
- `oh-my-opencode.jsonc`

Mục đích:
- cấu hình model mặc định
- cấu hình OMO
- đồng bộ hành vi của OpenCode với bộ custom này

---

### 2.7. `install_vnpt_bmad_custom_all.py`
Đây là script cài đặt tổng thể một lệnh.

Script này sẽ:
1. cài BMAD v6.2.0 theo cấu hình chuẩn đã chốt
2. nạp custom module `bmad-omo-integration/src`
3. chép các file customize cho:
   - `bmm-dev`
   - `bmm-ux-designer`
   - `bmm-architect`
4. cài skill:
   - `springboot-patterns`
   - `ui-ux-pro-max`
5. cài workflow UI concept vào OpenCode
6. cài overlay OMO vào OpenCode
7. cài `oh-my-opencode`
8. chép `opencode.json` và `oh-my-opencode.jsonc` vào `~/.config/opencode/`
9. tự tạo `docs/project-context.md` tạm nếu repo mới chưa có gì
10. verify kết quả sau khi cài

---

## 3. Các integration chính

### 3.1. BMAD + OMO
Tích hợp này nhằm tạo một execution path mạnh hơn cho story implementation.

Mục đích:
- tận dụng sức mạnh orchestration của OMO
- nhưng vẫn giữ BMAD làm source of truth cho process

Khi nào dùng:
- khi dev-story phức tạp
- khi cần execution loop mạnh hơn
- khi cần behavior kiểu OMO trong OpenCode

---

### 3.2. BMAD + UI UX Pro Max
Tích hợp này phục vụ cho:
- UX design
- frontend development
- UI concept generation

Mục tiêu:
- các tài liệu UX/UI có chất lượng cao hơn
- frontend code bám đúng artifacts đã thiết kế
- giảm sai lệch giữa thiết kế và hiện thực

---

### 3.3. BMAD + Spring Boot skill
Tích hợp này phục vụ backend Java/Spring Boot.

Mục tiêu:
- agent dev không code backend Java theo kiểu ngẫu hứng
- luôn bám layered architecture, validation, exception handling, logging, observability, production patterns

---

### 3.4. BMAD + Architecture deepening
Tích hợp architect custom giúp:
- phân tích kiến trúc sâu hơn
- tạo artifacts rõ ràng hơn
- có thêm LikeC4 như Architecture-as-Code
- giúp implementation và review có nguồn tham chiếu kiến trúc rõ ràng

---

## 4. Cấu trúc thư mục bundle

Ví dụ cấu trúc:

```text
vnpt-bmad-custom/
├── bmad-architect-custom/
├── bmad-dev-custom/
├── bmad-omo-integration/
├── bmad-ui-design-concept/
├── bmad-ux-designer-custom/
├── opencode_config/
└── install_vnpt_bmad_custom_all.py
```

Ý nghĩa:
- mỗi folder con là một khối custom/integration riêng
- script ở root sẽ gom và cài tất cả chỉ với 1 lệnh

---

## 5. Yêu cầu trước khi cài

Máy của bạn nên có sẵn:
- `python`
- `node` + `npx`
- `bunx`
- `git`
- OpenCode đã cài
- quyền ghi vào:
  - repo dự án
  - `~/.config/opencode/`

Khuyến nghị:
- chạy cài đặt khi repo dự án còn sạch
- sau khi cài xong nên restart OpenCode

---

## 6. Cách cài đặt tổng thể

### 6.1. Đặt script vào root bundle
Đảm bảo file:

- `install_vnpt_bmad_custom_all.py`

nằm ngay trong root của `vnpt-bmad-custom`.

### 6.2. Chạy script
Từ bất kỳ đâu, gọi:

```bash
python /path/to/vnpt-bmad-custom/install_vnpt_bmad_custom_all.py --repo /path/to/your/project
```

Nếu bạn đang đứng ngay trong repo dự án:

```bash
python /path/to/vnpt-bmad-custom/install_vnpt_bmad_custom_all.py --repo .
```

### 6.3. Nếu muốn bỏ qua cài `oh-my-opencode`
Dùng thêm cờ:

```bash
python /path/to/vnpt-bmad-custom/install_vnpt_bmad_custom_all.py --repo . --skip-oh-my-opencode
```

---

## 7. Script cài đặt sẽ làm gì

Script sẽ tự động thực hiện các bước sau.

### Bước 1: Chuẩn bị repo
- tạo các folder cần thiết:
  - `.opencode/skills`
  - `.opencode/commands`
  - `_bmad/_config/agents`
  - `docs`

### Bước 2: Chép customize cho các agent BMAD
- `bmm-dev.customize.yaml`
- `bmm-ux-designer.customize.yaml`
- `bmm-architect.customize.yaml`

### Bước 3: Cài BMAD v6.2.0
Script chạy BMAD install theo cấu hình đã chốt:
- directory = repo hiện tại
- modules = BMAD core + BMad Method
- custom module = `bmad-omo-integration/src`
- tool target = OpenCode
- user name = username hệ thống
- chat language = English
- document output language = English
- output folder = `docs`

### Bước 4: Cài OpenCode skills/commands cục bộ cho repo
- `springboot-patterns`
- `ui-ux-pro-max`
- `bmad-create-ui-design-concept`
- `bmad-dev-story-omo`

### Bước 5: Sync docs sang `AGENTS.md`
Script sẽ chạy sync cho OMO.

Nếu repo còn mới tinh và chưa có `docs/project-context.md`, script sẽ tự tạo một bản starter tối thiểu để không bị lỗi.

### Bước 6: Cài oh-my-opencode
Script chạy:

```bash
bunx oh-my-opencode install --no-tui --claude=no --gemini=no --copilot=no
```

Rồi tự trả lời:
- OpenCode Zen = No
- Z.ai Coding Plan = No
- Kimi For Coding = No

### Bước 7: Cài config global cho OpenCode
Copy:
- `opencode.json`
- `oh-my-opencode.jsonc`

vào:
- `~/.config/opencode/`

### Bước 8: Verify
Script kiểm tra lại toàn bộ file chính đã được cài.

---

## 8. Kết quả mong đợi sau khi cài

Sau khi cài xong, repo của bạn sẽ có tối thiểu:

### Trong `_bmad/_config/agents/`
- `bmm-dev.customize.yaml`
- `bmm-ux-designer.customize.yaml`
- `bmm-architect.customize.yaml`

### Trong `.opencode/skills/`
- `springboot-patterns/`
- `ui-ux-pro-max/`
- `bmad-create-ui-design-concept/`
- `bmad-dev-story-omo/`

### Trong `.opencode/commands/`
- `bmad-create-ui-design-concept.md`
- `bmad-dev-story-omo.md`

### Trong `docs/`
- `project-context.md` nếu repo ban đầu chưa có

### Trong `~/.config/opencode/`
- `opencode.json`
- `oh-my-opencode.jsonc`

---

## 9. Cách sử dụng sau khi cài

### 9.1. UX design
Bạn vẫn dùng workflow chuẩn của BMAD:
- `bmad-create-ux-design`

Nhưng giờ `bmm-ux-designer` sẽ tự động load `ui-ux-pro-max`.

---

### 9.2. UI concept
Bạn dùng:
- `bmad-create-ui-design-concept`

Output:
- `docs/ui-design/product-concept.html`

---

### 9.3. Dev story
Bạn vẫn dùng:
- `bmad-dev-story`

Nhưng giờ `bmm-dev` sẽ:
- nếu task là frontend/UI:
  - tự load `ui-ux-pro-max`
- nếu task là Java backend:
  - tự load `springboot-patterns`

Ngoài ra bạn còn có thể dùng:
- `bmad-dev-story-omo`

khi muốn tăng cường execution bằng OMO.

---

### 9.4. Architect
Bạn vẫn dùng workflow architect chuẩn của BMAD.

Nhưng `bmm-architect` giờ sẽ:
- reasoning sâu hơn
- tạo LikeC4
- link tài liệu markdown tới các file LikeC4

---

## 10. Lưu ý vận hành

1. Đây là bộ custom dành riêng cho **BMAD v6.2.0**
2. OpenCode nên được restart sau khi cài
3. Repo mới hoàn toàn vẫn cài được vì script sẽ tạo `docs/project-context.md` tạm
4. `docs/project-context.md` tạm chỉ là file bootstrap, sau này nên thay bằng project context thật do BMAD tạo ra
5. nếu một thành phần đã tồn tại từ trước, script có thể ghi đè để đồng bộ về bộ custom hiện tại
6. config global của OpenCode sẽ được backup trước khi copy file mới

---

## 11. Khi nào nên chạy lại script

Bạn nên chạy lại script khi:
- tạo repo mới
- cập nhật bundle custom
- muốn đồng bộ lại toàn bộ customizations
- lỡ xóa mất skill/command/config

---

## 12. Gợi ý quy trình làm việc

Một flow gợi ý sau khi cài:

1. tạo PRD / planning bằng BMAD
2. tạo UX bằng `bmad-create-ux-design`
3. tạo UI concept bằng `bmad-create-ui-design-concept`
4. tạo architecture bằng architect agent đã customize
5. dùng `bmad-dev-story` để triển khai
6. khi story frontend → tự load `ui-ux-pro-max`
7. khi story Java backend → tự load `springboot-patterns`
8. khi story phức tạp → dùng thêm `bmad-dev-story-omo`

---

## 13. Tóm tắt ngắn

`vnpt-bmad-custom` là một bộ tích hợp giúp:
- BMAD làm quy trình chính
- OpenCode làm AI IDE chính
- OMO làm execution layer bổ sung
- UI/UX được tăng cường bằng `ui-ux-pro-max`
- Java backend được tăng cường bằng `springboot-patterns`
- architect được tăng cường bằng tư duy kiến trúc sâu hơn và LikeC4

Tất cả được cài lại chỉ bằng **1 script duy nhất**:

```bash
python install_vnpt_bmad_custom_all.py --repo /path/to/project
```
