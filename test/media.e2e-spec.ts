import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './../src/app.module';

describe('MediaController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let secondUserToken: string;
  let mediaId: string;
  let secondUserId: string;

  const testUser = {
    email: `media-test-${Date.now()}@example.com`,
    password: 'Test123!@#',
  };

  const secondUser = {
    email: `media-test-2-${Date.now()}@example.com`,
    password: 'Test123!@#',
  };

  const testFilePath = path.join(__dirname, 'empty-wallet.jpeg');
  const testFileBuffer = fs.readFileSync(testFilePath);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Register and login first user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);
    
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testUser);
    
    accessToken = loginResponse.body.accessToken;

    // Register and login second user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(secondUser);
    
    const secondLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(secondUser);
    
    secondUserToken = secondLoginResponse.body.accessToken;

    // Get second user's info to get their ID
    const secondUserInfo = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${secondUserToken}`);
    
    secondUserId = secondUserInfo.body.user.sub || secondUserInfo.body.user._id || secondUserInfo.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/media/upload (POST)', () => {
    it('should upload a JPEG file', () => {
      return request(app.getHttpServer())
        .post('/media/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', testFileBuffer, 'test.jpeg')
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('media');
          expect(res.body.media).toHaveProperty('_id');
          expect(res.body.media).toHaveProperty('fileName');
          expect(res.body.media).toHaveProperty('mimeType', 'image/jpeg');
          mediaId = res.body.media._id;
        });
    });

    it('should fail to upload without authentication', () => {
      return request(app.getHttpServer())
        .post('/media/upload')
        .attach('file', testFileBuffer, 'test.jpeg')
        .expect(401);
    });

    it('should fail to upload without file', () => {
      return request(app.getHttpServer())
        .post('/media/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('/media/my (GET)', () => {
    it('should list authenticated user media files', () => {
      return request(app.getHttpServer())
        .get('/media/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('_id');
          expect(res.body[0]).toHaveProperty('fileName');
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .get('/media/my')
        .expect(401);
    });
  });

  describe('/media/:id (GET)', () => {
    it('should get media by ID as owner', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('_id', mediaId);
          expect(res.body).toHaveProperty('fileName');
          expect(res.body).toHaveProperty('mimeType');
        });
    });

    it('should fail to get media without authentication', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}`)
        .expect(401);
    });

    it('should fail to get media as non-owner without permission', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(404);
    });
  });

  describe('/media/:id/permissions (GET)', () => {
    it('should get media permissions as owner', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}/permissions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('mediaId');
          expect(res.body).toHaveProperty('allowedUserIds');
          expect(Array.isArray(res.body.allowedUserIds)).toBe(true);
        });
    });

    it('should fail to get permissions as non-owner', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}/permissions`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}/permissions`)
        .expect(401);
    });
  });

  describe('/media/:id/permissions (POST)', () => {
    it('should set media permissions as owner', () => {
      return request(app.getHttpServer())
        .post(`/media/${mediaId}/permissions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userIds: [secondUserId] })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('permissions');
        });
    });

    it('should allow second user to access media after permission granted', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200);
    });

    it('should fail to set permissions as non-owner', () => {
      return request(app.getHttpServer())
        .post(`/media/${mediaId}/permissions`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({ userIds: [] })
        .expect(403);
    });

    it('should fail to set permissions with invalid user IDs', () => {
      return request(app.getHttpServer())
        .post(`/media/${mediaId}/permissions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userIds: ['invalid-id'] })
        .expect(400);
    });
  });

  describe('/media/:id/download (GET)', () => {
    it('should download media as owner', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}/download`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect('Content-Type', 'image/jpeg');
    });

    it('should download media as user with permission', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}/download`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200)
        .expect('Content-Type', 'image/jpeg');
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}/download`)
        .expect(401);
    });
  });

  describe('/media/:id (DELETE)', () => {
    it('should fail to delete as non-owner', () => {
      return request(app.getHttpServer())
        .delete(`/media/${mediaId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);
    });

    it('should delete media as owner', () => {
      return request(app.getHttpServer())
        .delete(`/media/${mediaId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should fail to get deleted media', () => {
      return request(app.getHttpServer())
        .get(`/media/${mediaId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should fail to delete non-existent media', () => {
      return request(app.getHttpServer())
        .delete(`/media/${mediaId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
