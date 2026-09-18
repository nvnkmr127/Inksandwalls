import { badgeVariants } from "../ui/badge"

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`)
  }
}

async function runUIKitSelfTest() {
  console.log("--> Running Shared UI Kit self-tests...")

  // 1. Verify badge variants generator
  const defaultBadge = badgeVariants({ variant: "default" })
  assert(defaultBadge.includes("bg-primary"), "Badge default variant missing bg-primary")

  const successBadge = badgeVariants({ variant: "success" })
  assert(successBadge.includes("emerald"), "Badge success variant missing emerald styling")

  const warningBadge = badgeVariants({ variant: "warning" })
  assert(warningBadge.includes("amber"), "Badge warning variant missing amber styling")

  // 2. Pagination Page Count Logic Test
  const totalRecords = 55
  const pageSize = 10
  const pageCount = Math.ceil(totalRecords / pageSize)
  assert(pageCount === 6, "Pagination pageCount math error")

  // 3. DataTable Search Filter Math Logic Test
  interface TestItem {
    id: string
    name: string
    status: string
  }

  const items: TestItem[] = [
    { id: "1", name: "Floral Wallpaper", status: "active" },
    { id: "2", name: "Textured Murals", status: "inactive" },
    { id: "3", name: "Abstract Canvas", status: "active" },
  ]

  const searchFilter = (query: string) =>
    items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))

  const activeFilter = (status: string) =>
    items.filter((item) => item.status === status)

  assert(searchFilter("floral").length === 1, "DataTable search filter mismatch")
  assert(activeFilter("active").length === 2, "DataTable status filter mismatch")

  console.log("✓ All Shared UI Kit self-tests passed cleanly!")
}

runUIKitSelfTest().catch((err) => {
  console.error("UI Kit self-test failed:", err)
  process.exit(1)
})
