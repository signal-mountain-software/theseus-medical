/**
 * Factory for wrapping a Component with specified HOCs (Higher-Order Components).
 *
 * (Note: set rtl = false if you want the outermost HOC layer to be the LAST index)
 *
 * @author Jalo Moster <jlvmoster@gmail.com>
 * @version 2.0.0
 * @since 7/12/2020
 *
 * @param Component the component to wrap
 * @param hocs the hocs for wrapping the component
 * @param rtl wrap the component from the rightmost (last index) hoc to the leftmost (first index)
 * @returns {React.Component}
 */
export default (Component, hocs = [], rtl = true) => {
  if (hocs.length > 0) {
    if (rtl) {
      return hocs.reduceRight((DerivedComponent, withHOC) => withHOC(DerivedComponent), Component);
    }
    return hocs.reduce((DerivedComponent, withHOC) => withHOC(DerivedComponent), Component);
  }
  return Component;
};
