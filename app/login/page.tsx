import { redirect } from "next/navigation";

// The dashboard has no password (owner's decision, 10 Oct). Old /login links go straight in.
export default function LoginPage() {
  redirect("/");
}
