import { eq } from "drizzle-orm";
import db from "../db/index.ts";
import { users } from "../db/schema.ts";
import type { NewUser, User } from "../db/schema.ts";

class UserRepository {
  private db;
  private users;

  constructor() {
    this.db = db;
    this.users = users;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return await this.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });
  }

  async create(user: NewUser) {
    return await this.db.insert(this.users).values(user);
  }

  async updateLastLogin(email: string, ip: string, userAgent: string) {
    return await this.db
      .update(this.users)
      .set({
        lastLogin: new Date(),
        lastIp: ip,
        lastUserAgent: userAgent,
      })
      .where(eq(this.users.email, email))
      .returning();
  }
}

export default UserRepository;
