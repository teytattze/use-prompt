import { Spinner } from "@/component/ui/spinner";

type PendingProps = {
  message?: string;
};

export function Pending({ message }: PendingProps) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center gap-2 text-center">
      <Spinner />
      <p>{message ?? "Loading..."}</p>
    </div>
  );
}
