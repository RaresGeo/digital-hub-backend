import type { User } from "../../db/schema.ts";
import { Context } from "../../deps.ts";

function getProfileHandler() {
  return (context: Context) => {
    const user = context.state.user as User;

    if (!user) {
      context.response.status = 404;
      context.response.body = { message: "User not found" };
      return;
    }

    context.response.status = 200;
    context.response.body = user;
  };
}

export default getProfileHandler;
