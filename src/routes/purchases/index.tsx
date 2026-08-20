import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/purchases/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/purchases/"!</div>
}
