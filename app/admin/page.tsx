import { redirect } from "next/navigation";
import AdminClient from "./client";
import { isAdmin } from "@/lib/admin-auth";
export const dynamic="force-dynamic";
export default async function AdminPage(){if(!await isAdmin())redirect("/admin/login");return <AdminClient/>}
