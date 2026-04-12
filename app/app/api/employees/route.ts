import { NextRequest, NextResponse } from "next/server";
import { hireEmployee, listEmployees, fireEmployee } from "@/lib/backend-client";

export async function GET() {
  try {
    const res = await listEmployees();
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ ok: true, employees: data });
    }
    return NextResponse.json({ ok: false, employees: [] });
  } catch {
    return NextResponse.json({ ok: false, employees: [] });
  }
}

export async function POST(req: NextRequest) {
  const { role, config } = await req.json();
  try {
    const res = await hireEmployee(role, config);
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 201 : 500 });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  const { agentId } = await req.json();
  try {
    await fireEmployee(agentId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }
}
