# ���°���Ŀ�鿴������˵��

�������ڣ�2026-10-24��

## �鿴������������Ŀ

- ����ͳһ��ά����[��ȫ���ļ����ļ���](https://github.com/AlisLanner/workplace-survival-capsule/tree/feature/unified-ge8-20261016)��
- �ڸ�ҳ���� **Code �� Download ZIP**�������ظ÷�֧������Դ�롣����鿴����ʱ���谲װ����������ģ�͡�
- Ĭ�� `main` ��֧���޸�ǰ���ȶ��汾���°���롢��ʾ�ʡ��������弰��˵���� `feature/unified-ge8-20261016` ��֧������Ŀʱ��ȷ�Ϸ�֧���ơ�

| Ŀ¼ | ���� |
| --- | --- |
| `frontend/` | ��ҳ���龳ѡ�����𡢰�ά����͹������棬���ز�����ʽ |
| `backend/src/` | �Ի����ȡ���ɫ���ػ������֡�����У�顢��Ƽ��ӿ� |
| `backend/src/assessment/` | ͳһ��ά������ʽ�龳���汾�������֤��Э�� |
| `backend/src/prompts/` | ��ɫ��������ʾ�ʣ�����ͳһ��άģ�� |
| `backend/prisma/` | ���ݽṹ��Ǩ�ƺ�Ĭ���龳���ӳ��� |
| `backend/tests/`��ǰ�˲����ļ� | �Զ�����֤ |
| `scripts/`��`backend/scripts/` | ��ʼ�������������ƿ���֤������ͻָ����� |
| `docs/` | ����ʵ��˵������ʷ�ĵ�����ǰʵ�ֿھ��� `ge8-implementation.md` ���İ汾��¼ |
| `package.json`��`package-lock.json` | �������������������� |

Դ�벻�������� API ��Կ����̨������������ļ�����ʵ�������ݿ⡢������־��˽���о����ϻ򱾻�·���������á�`node_modules` �͹�����������ļ��������ɣ�������ʾ�⡢��ͼ����ƵҲ����ΪĬ�ϳ������ݷ�����

## �µ�����������ͳһ��ά��

��Ҫ Node.js 24 ����߰汾���� npm��Git ����ͨ����¡����ʱ��Ҫ�������� Windows PowerShell ��ȫ��Ŀ¼Ϊ������Ҫ������ʹ�õ����ݿ�����ִ�г�ʼ�������ӳ���

��ʹ�� Git ���أ�

```powershell
git clone --branch feature/unified-ge8-20261016 --single-branch https://github.com/AlisLanner/workplace-survival-capsule.git
cd workplace-survival-capsule
```

��ʹ�� ZIP����ѹ���ڰ��� `package.json` ����Ŀ��Ŀ¼�� PowerShell���������У�

```powershell
Copy-Item backend/.env.example backend/.env
npm ci
npm run prisma:generate -w backend
npm run backend:build
npm run frontend:build
New-Item -ItemType Directory -Path .local-data -Force
$demoDatabase = Join-Path (Get-Location) '.local-data/ge8-demo.db'
node scripts/init-ge8.cjs $demoDatabase
node scripts/local-server.cjs --database $demoDatabase --mode mock --port 17861
```

`Copy-Item` ������ȫ�����أ�û���������õ����Σ����� `backend/.env` ʱ�����Լ����ļ����¿��ʼ���ᴴ���ṹ��д��Ĭ���龳����װͳһ��ά `.12`������ͬ�����ݿ��ܾ����ǡ�����ɳ�ʼ��ʱֱ���������һ���������

��������� **http://127.0.0.1:17861/scenarios**���ն��豣�����У��� Ctrl+C ֹͣ���˷��������������

���� `mock` ģʽ����Ҫģ����Կ��Ҳ������ģ�� API ��ȣ��������˽������������֤���棬���ɵ�ģ�������ܵ�����ʵģ�����ֻ���Ա�������ݡ�ϣ���鿴��������ʱ�����һ�����߻�������뱨��ҳ��

## ʹ����ʵģ��

���������Դ�밲װ���¿��ʼ�����ڱ��� `backend/.env` �����Լ��Ľӿڵ�ַ����Կ��ģ�͡���ʵģʽ����ʽ������

```powershell
node scripts/local-server.cjs --database $demoDatabase --mode real --port 17861
```

��ʵ�����ͱ������ɻ�������õ�ģ�Ͳ����ܲ������á����й�������ʹ�� Flash�����и����ṩ�߻��ͺź�Ӧ���º˶Խӿڼ��������������������ʹ����ݺϷ����ֽ�����ܣ�����ʧ�ܡ�����û���������Ҫ�˹����˵����β��ᱻα�����Ч������

## ��ǰ�汾�ķ�Χ

- �����汾��`ge8-20261016.12`���˸�ά�ȣ�ÿά 0��20 �֣����������ֽ������Ϊ 0��160 �֡�
- ��ʽ�°��龳��A��B��C��E��D �Ǳ����ľɰ���ʾ���¾ɰ汾�����龳��������ֱ�ӱȽϡ�
- ֧�ֶ��ɫ׷�ʡ���� 15 �����𡢱�����ȡ���ά�������۲�����ݡ����Ķ�λ�������Ի��ؿ���
- ����δչ��������ʵ���������Ӧʱ�����԰���������γ���Ӧ���֣�����δ���𡢱�Ҫ����δ�ṩ����ʧ�����и��Ե�״̬��
- ����ɵĹ��̼���ʾ���Ự����˵���������������������Ŀ���λ��Ա����Ч���о���Ҳ��������Ƹ��̭�ߡ�
- �ɱ�Я������ʷ�ĵ��;��龳�������԰汾�����ܰѾɰ��Զ���Ϊ����֧��ͳһ��ά�³���

## �������

```powershell
npm test
npm run test -w frontend
npm run backend:build
npm run frontend:build
```

ר����֤�ű����������ƺͰ汾��װ���������ָ�˵���� [ͳһ��άʵ�ּ�¼](ge8-implementation.md)��ֻ����ʽ������ʵģ�����սű���Ӧ����ģ�����󣻲鿴Դ�롢�����ѱ��汨���������Ŀ����Ҫ����ģ�͡�
