# ����LLM Multi-Agent��ְ���龳��������ϵͳ

## ��ǰͳһ��ά�汾����Ŀ����

��ǰͳһ��ά����λ�� [`feature/unified-ge8-20261016` ��֧](https://github.com/AlisLanner/workplace-survival-capsule/tree/feature/unified-ge8-20261016)�������汾Ϊ `ge8-20261016.12`��������Ŀʱ��ʹ�ô����ӣ�Ĭ�� `main` ��֧�����޸�ǰ���ȶ��汾��

�÷�֧��������ǰ���Դ���롢�����زġ���ʾ�ʡ���ά�������塢���ݿ�ṹ��Ǩ�ơ����ԡ���װ�����Ͱ汾�ָ����ߡ���ʽ�°��龳Ϊ **A��B��C��E**��D ����Ϊ�ɰ���ʾ�������鿴�����غ����µ��������еķ����� **[���°���Ŀ�鿴������˵��](docs/project-sharing.md)**�������ͨ�ÿ������ɰ��Я˵����Ϊ����ο���

ͳһ��ά�°�����ɱ������̼�����ʾ��֧�ְ�ά���֡���ά���͡�����ԭ�Ķ�λ�������Ի��ؿ������̼���Ԥ������ʾ���𲻵���Ŀ���λ��Ա�Ĳ���Ч����֤������ API ��Կ���������á��������ݿ⡢�Ի���־���о��׸岻������Դ���У����غ�ʹ���Լ��ı��������������ݿ⡣

����LLM Multi-Agent��ְ���龳��������ϵͳ��һ��ְ���龳��Ϊ�۲��뷴��ԭ�͡��û��ڸ�ѹְ���������������ɫ�Ի���ϵͳͨ�������ſء�׷�ʵ��ȡ�֤�ݸ��Ǹ��ٺ� Judge Agent ��β��������ɿ�׷�ݵ���Ϊ�۲챨�档

��ǰ�汾�ʺ�ԭ����ʾ��������֤���о����ݲɼ�������������龳��Ϊ�۲췴������Ӧ����������Ƹ����������̭����Ч�����ȸ߷������¾��ߡ�

## ���ܸ���

- ������������龳����Ŀ����Σ������������Ļ����ң�������Σ����8�����Ŀ��ˣ��������¹ʣ�����ٵĹ��Ϲ��������������̣����ֵĵ����ܣ�����������Խӣ���ְ��һ�ܵ�����Խӣ���
- Multi-Agent �Ի����̣�Response Quality Gate��Director��NPC ��ɫ��Group Discussion��Judge Agent��
- SSE ��ʽ���죺NPC �ظ��� token չʾ��
- �������ɽ��ȣ�����׶Ρ�Judge �������ȡ��ӳٵȴ���ʾ��
- ��������ѧȡ�򱨸棺�ο�ָ�����۲����䡢ά��֤�ݡ�������˹�����״̬��
- ������̨���Ǳ��̡��������á���ʾ�ʱ༭���Ự�طš�Ⱥ��У���¼�ͱ���鿴��
- ���� mock ģʽ������Ҫ��ģ�� API key��Ҳ������ API ��ȡ�
- SQLite �������ݿ⣺����Ҫ Docker �� PostgreSQL��

## Ӧ�ó�����Ŀ���û�

MAAT ���龳�����ö�����ƣ���� `docs/Ӧ�ó�����Ŀ���û�.md`����

1. **У�У�Ӧ���� �� ִ��/רҵ�ڣ�**��ִ�в��龳����ְ��һ�ܵ�����Խӡ������ܲ��߽�ɫ��Ӧ����ְ��һ�£��۲�������塢�߽�������������
2. **�в�ѡ�� / ��������ѵ**���������龳��������������Ļ����ҡ������ֵĵ����ܡ��������ƽ��ͣ����϶��롢��ԴЭ�����Ŷӹ���������8�����Ŀ��ˡ�������ٵĹ��Ϲ��������ֳ�Σ���ͣ�һ����Ӫ��Σ��ָ�ӣ���ѡ��ֱ��ʹ����Ŀ���λ�㼶һ�µ��龳����ѵ���׷�չ���飬֧�ֲ��� �� ������̸ �� ����ջ���
3. **��У��ѧ**����֯��Ϊѧ���˲Ų����γ̽�ѧ���ߣ����߱�Я�� + ���� mock ģʽ���ڿ��ý�ɫ����ʵѵ��������̨���Զ�����������ʾ�ʡ�

## ����ջ

| ģ�� | ���� |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma |
| Database | SQLite |
| Tests | Vitest |
| LLM | DeepSeek API �򱾵� mock fallback |

## ��Ŀ�ṹ

```text
workplace-survival-capsule/
  backend/                Express API, Prisma, agents, prompts, tests
  frontend/               React app, pages, components, styles
  docs/                   �ܹ��ƻ����о����桢��Ŀ�ĵ�
  scripts/                ���ذ�װ�������ű�
  setup-local.bat         Windows һ����ʼ��
  start-dev.bat           Windows һ������ǰ���
  tail-backend-log.bat    �鿴�����־
```

## ���ؿ�������

### Windows ��Я��

���±�Яѹ������ [GitHub Releases](https://github.com/xianghaoyu2001/workplace-survival-capsule/releases/latest) ���ء���ѹ��˫�� `START.bat`�����谲װ Node.js��Ĭ��ʹ������ mock��API key Ϊ�գ�������Կ��ÿ������ʱ��ʱ���ɡ�������ֻ�������Ĭ�ϳ����Ͱ˸���ʾ�ʣ������������������ݡ�

Դ�������Я�������� `scripts/build-portable.cjs`�����´��ǰ�������·����������������� Windows Node.js ����ʱ���� `portable-release/runtime/node.exe`���ö����Ʋ��ύ�� Git����ִ�У�

```powershell
node scripts/build-portable.cjs windows-test
node scripts/test-portable.cjs portable-release/windows-test
node scripts/build-portable.cjs windows-release
Compress-Archive -Path portable-release/windows-release/* -DestinationPath portable-release/windows-release.zip
```

ð�̲��Ի�д����ԻỰ����˱����ڶ�������Ŀ¼�����У���ʽ����ʱʹ����һ��ȫ��Ŀ¼������ű������Ʊ��� `.env` ���������ݿ⡣

Windows �û�����ֱ��ʹ���������ű���

1. ˫����Ŀ��Ŀ¼�� `setup-local.bat`��
2. �ȴ��ն���ʾ `Setup completed.`��
3. ˫�� `start-dev.bat`��
4. ������� `http://localhost:5173`��

`setup-local.bat` ���Զ���ɣ�

- ���� `backend/.env`��
- ��װ������
- ���� Prisma Client��
- ���� SQLite ���ݿ����
- д��Ĭ�ϳ����� Agent ��ʾ�ʡ�

������쿨ס�򱨴���˫�� `tail-backend-log.bat` �鿴���ʵʱ��־��

## ����������

```powershell
cd D:\job_project\workplace-survival-capsule
npm run setup:local
```

�ֱ�������˺�ǰ�ˣ�

```powershell
npm run backend:dev
npm run frontend:dev
```

���ʵ�ַ��

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/health`

## ��������

���������ļ��� `backend/.env`�����ļ��� `.gitignore` ���ԣ������ύ�� GitHub��

Ĭ�� mock ģʽ��

```env
DATABASE_URL="file:./dev.db"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_FAST_MODEL="deepseek-v4-flash"
DEEPSEEK_STRONG_MODEL="deepseek-v4-pro"
USE_MOCK_LLM="true"
PORT=3000
CORS_ORIGIN="*"
```

����ʹ����ʵ DeepSeek API���ڱ��� `backend/.env` ����д�Լ��� key�����ر� mock��

```env
DEEPSEEK_API_KEY=""
USE_MOCK_LLM="false"
```

��̨�ӿڿ�ѡ���� `ADMIN_SECRET`����������ã���˻��������غ�̨����Կ���ʣ�������𵽹������������ã�

```env
ADMIN_SECRET=""
```

ǰ�˿�ѡ���ü� `frontend/.env.example`��

```env
VITE_API_BASE="http://localhost:3000"
```

## ���ýű�

| ���� | ˵�� |
| --- | --- |
| `npm run setup:local` | �������� `.env`����װ������Ǩ�� SQLite��д���������� |
| `npm run backend:dev` | ������������� |
| `npm run frontend:dev` | ���� Vite ǰ�˿������� |
| `npm run backend:build` | ��� TypeScript ���� |
| `npm run frontend:build` | ǰ�����ͼ����������� |
| `npm run test` | ���к�� Vitest ���� |

## ��ȫ˵��

- ��Ҫ�ύ `backend/.env`����ʵ API key�����ݿ��ļ�����־��
- `.gitignore` ���ų� `.env`��`node_modules`��`dist`����־��SQLite ���ݿ⡢Word ��ʱ�ļ��� TypeScript �������档
- �ֿ��е� `backend/.env.example` �� `frontend/.env.example` ֻ������ֵ�򹫿�Ĭ��ֵ��
- �ϴ�ǰ��������һ�� staged secret scan��ȷ��û�� key/token �������ύ��

## ��֤

��ǰ��Ŀ��ͨ������������������֤��

```powershell
npm run backend:build
npm run frontend:build
npm run test
```

��˲��Ը��� agent view��assessment design��Judge Agent��response quality��slot tracker �� JSON ���ߵȹؼ��߼���

## �о����ĵ�

`docs/` �°����ܹ��ƻ������ļƻ���ǰ�˹��� MAAT ��������ѧ�о����档���������汨��Ϊ��

```text
docs/MAAT_report_v5.2.docx
```

�����е�Ч�ȡ���ģ�͹�ƽ����֤·�����ں����о��滮����ǰ�����汾����ԭ��ϵͳ��

## ����ע

���ؿ���ʹ�� SQLite���ʺ���ʾ��С��ģ���ԡ���ʽ����ʱ���飺

- ʹ���ܿص��������ݿ⡣
- ���� `ADMIN_SECRET` ���ϸ�� `CORS_ORIGIN`��
- ʹ�� HTTPS �ͷ������־��ת��
- �̶� LLM ģ�Ͱ汾����¼��ʾ�ʰ汾���������Ρ�
- ����ʵ���ݽ������ѧ����ǰ���֪��ͬ�����˽������
