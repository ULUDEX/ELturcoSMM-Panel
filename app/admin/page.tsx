import { redirect } from "next/navigation";
import AdminPanel from "./panel";
import { isAdmin } from "@/lib/admin-auth";
export const dynamic="force-dynamic";
export default async function AdminPage(){if(!await isAdmin())redirect("/admin/login");return <AdminPanel/>}
