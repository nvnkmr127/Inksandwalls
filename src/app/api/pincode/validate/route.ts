import { NextRequest, NextResponse } from "next/server";
import { validatePincode } from "@/lib/pincode/pincode-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pincode = searchParams.get("pincode");

  if (!pincode) {
    return NextResponse.json(
      { valid: false, isDeliverable: false, error: "Pincode query parameter is required." },
      { status: 400 }
    );
  }

  const result = validatePincode(pincode);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pincode = body?.pincode;

    if (!pincode) {
      return NextResponse.json(
        { valid: false, isDeliverable: false, error: "Pincode is required." },
        { status: 400 }
      );
    }

    const result = validatePincode(pincode);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { valid: false, isDeliverable: false, error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
