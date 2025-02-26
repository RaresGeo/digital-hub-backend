import { Context } from "../../deps.ts";

function logoutHandler() {
  return (context: Context) => {
    context.cookies.delete("jwt");
    context.cookies.delete("refreshToken");

    context.response.status = 200;
    context.response.body = { message: "Logged out successfully" };

    context.response.redirect(Deno.env.get("FRONTEND_URL")!);
  };
}

export default logoutHandler;
