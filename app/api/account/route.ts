import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
export async function GET(){const user=await currentCustomer();return NextResponse.json(user?{loggedIn:true,user}:{loggedIn:false})}
