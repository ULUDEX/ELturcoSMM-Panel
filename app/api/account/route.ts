import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
export const dynamic="force-dynamic";
export async function GET(){const user=await currentCustomer();return NextResponse.json(user?{loggedIn:true,user}:{loggedIn:false},{headers:{"cache-control":"private, no-store, max-age=0","vary":"Cookie"}})}
