import {
  PinInput,
  PinInputControl,
  PinInputInput,
  PinInputLabel,
} from "@kanzo-tech/ui";

const cells = Array.from({ length: 6 }, (_, index) => index);

export default function Example() {
  return (
    <PinInput otp>
      <PinInputLabel>Verification code</PinInputLabel>
      <PinInputControl>
        {cells.map((index) => (
          <PinInputInput key={index} index={index} />
        ))}
      </PinInputControl>
    </PinInput>
  );
}
