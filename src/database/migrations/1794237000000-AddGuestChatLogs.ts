import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allows chat history to belong either to a registered user or to a guest session.
 * Exactly one owner must be set for every chat log.
 */
export class AddGuestChatLogs1794237000000 implements MigrationInterface {
  name = 'AddGuestChatLogs1794237000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_logs" ALTER COLUMN "user_id" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "chat_logs" ADD "guest_session_id" uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE "chat_logs" ADD CONSTRAINT "CHK_chat_logs_exactly_one_owner" CHECK (("user_id" IS NOT NULL AND "guest_session_id" IS NULL) OR ("user_id" IS NULL AND "guest_session_id" IS NOT NULL))`,
    );

    await queryRunner.query(
      `ALTER TABLE "chat_logs" ADD CONSTRAINT "FK_chat_logs_guest_session" FOREIGN KEY ("guest_session_id") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_b8e064ecd571c3a61137b15ab7" ON "chat_logs" ("guest_session_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Guest chat history cannot be retained after restoring user_id to NOT NULL.
    await queryRunner.query(
      `DELETE FROM "chat_logs" WHERE "guest_session_id" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "chat_logs" DROP CONSTRAINT "FK_chat_logs_guest_session"`,
    );

    await queryRunner.query(
      `ALTER TABLE "chat_logs" DROP CONSTRAINT "CHK_chat_logs_exactly_one_owner"`,
    );

    await queryRunner.query(
      `DROP INDEX "IDX_b8e064ecd571c3a61137b15ab7"`,
    );

    await queryRunner.query(
      `ALTER TABLE "chat_logs" DROP COLUMN "guest_session_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "chat_logs" ALTER COLUMN "user_id" SET NOT NULL`,
    );
  }
}
