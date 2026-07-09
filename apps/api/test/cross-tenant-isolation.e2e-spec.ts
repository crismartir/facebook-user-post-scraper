import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Isolamento multi-tenant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueEmail(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  }

  it('bloqueia acesso cross-tenant via guard de aplicação (404) e via RLS no banco', async () => {
    const agentA = request.agent(app.getHttpServer());
    const agentB = request.agent(app.getHttpServer());

    const registerA = await agentA.post('/auth/register').send({
      companyName: 'Empresa A',
      email: uniqueEmail('a'),
      password: 'senha-super-segura-123',
    });
    expect(registerA.status).toBe(201);
    const tenantAId = registerA.body.tenantId as string;

    const registerB = await agentB.post('/auth/register').send({
      companyName: 'Empresa B',
      email: uniqueEmail('b'),
      password: 'senha-super-segura-456',
    });
    expect(registerB.status).toBe(201);
    const tenantBId = registerB.body.tenantId as string;

    expect(tenantAId).not.toBe(tenantBId);

    const ownOverview = await agentA.get(`/tenancy/tenants/${tenantAId}`);
    expect(ownOverview.status).toBe(200);
    expect(ownOverview.body.tenant.id).toBe(tenantAId);
    expect(ownOverview.body.members).toHaveLength(1);

    const crossTenant = await agentA.get(`/tenancy/tenants/${tenantBId}`);
    expect(crossTenant.status).toBe(404);

    // Segunda camada de defesa (ADR-0001): mesmo indo direto ao banco com o
    // contexto RLS de A, nenhuma linha de B é retornada.
    const rowsVisibleToA = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantAId}, true)`;
      return tx.membership.findMany({ where: { tenantId: tenantBId } });
    });
    expect(rowsVisibleToA).toHaveLength(0);
  });

  it('rejeita requisições sem token de acesso', async () => {
    const res = await request(app.getHttpServer()).get('/tenancy/me');
    expect(res.status).toBe(401);
  });

  it('login falha com senha incorreta e não revela se o e-mail existe', async () => {
    const email = uniqueEmail('c');
    await request(app.getHttpServer()).post('/auth/register').send({
      companyName: 'Empresa C',
      email,
      password: 'senha-correta-123456',
    });

    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'senha-errada-000000' });
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: uniqueEmail('nao-existe'), password: 'qualquer-coisa-123456' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('refresh token rotativo: reuso de um token já rotacionado revoga a sessão', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = uniqueEmail('d');
    const registerRes = await agent.post('/auth/register').send({
      companyName: 'Empresa D',
      email,
      password: 'senha-valida-123456',
    });

    const firstRefreshCookie = extractCookie(registerRes.headers['set-cookie'], 'refresh_token');

    const rotated = await agent.post('/auth/refresh');
    expect(rotated.status).toBe(200);

    // Reapresenta o refresh token antigo (já rotacionado) manualmente.
    const reuse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`refresh_token=${firstRefreshCookie}`]);
    expect(reuse.status).toBe(401);

    // A sessão inteira foi revogada: nem o token novo (já rotacionado) funciona mais.
    const afterReuse = await agent.post('/auth/refresh');
    expect(afterReuse.status).toBe(401);
  });
});

function extractCookie(setCookieHeader: string | string[] | undefined, name: string): string {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const raw = cookies.find((c) => c.startsWith(`${name}=`));
  if (!raw) {
    throw new Error(`Cookie ${name} não encontrado na resposta`);
  }
  return raw.split(';')[0].split('=')[1];
}
