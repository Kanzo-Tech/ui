import { Progress, ProgressValue } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-72">
      <Progress value={64}>
        <ProgressValue />
      </Progress>
    </div>
  );
}
