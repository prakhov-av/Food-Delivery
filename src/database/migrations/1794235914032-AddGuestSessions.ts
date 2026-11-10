import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuestSessions1794235914032 implements MigrationInterface {
  name = 'AddGuestSessions1794235914032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`,
    );
    await queryRunner.query(
      `CREATE TABLE "guest_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token_hash" character varying(64) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "last_activity_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP, CONSTRAINT "UQ_33265284eb1ea21e20bfc3a3854" UNIQUE ("token_hash"), CONSTRAINT "PK_7c077389b040139ae9487c1b03e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "guest_session_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "customer_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_exactly_one_owner" CHECK (("customer_id" IS NOT NULL AND "guest_session_id" IS NULL) OR ("customer_id" IS NULL AND "guest_session_id" IS NOT NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_5db0f806736cb4d76f8d2957228" FOREIGN KEY ("guest_session_id") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем гостевые заказы, пока действует CASCADE для order_items.
    await queryRunner.query(`
      DELETE FROM "orders"
      WHERE "guest_session_id" IS NOT NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_5db0f806736cb4d76f8d2957228"`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9"`,
    );

    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_exactly_one_owner"`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "customer_id" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "guest_session_id"`,
    );

    await queryRunner.query(`DROP TABLE "guest_sessions"`);

    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
