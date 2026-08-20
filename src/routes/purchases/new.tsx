import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/purchases/new')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/purchases/new"!</div>
}
