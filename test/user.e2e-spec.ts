import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  const testUser = {
    email: `user-test-${Date.now()}@example.com`,
    password: 'Test123!@#',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Register and login to get access token
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);
    
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testUser);
    
    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/users/me (GET)', () => {
    it('should return authenticated user info with valid token', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body.user).toHaveProperty('email');
          expect(res.body.user.email).toBe(testUser.email);
        });
    });

    it('should fail without authorization header', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .expect(401);
    });

    it('should fail with invalid token', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should fail with malformed authorization header', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);
    });

    it('should fail with empty bearer token', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer ')
        .expect(401);
    });
  });
});
