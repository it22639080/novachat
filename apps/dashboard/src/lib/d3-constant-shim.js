export default function constant(value) {
  return function constantValue() {
    return value;
  };
}
