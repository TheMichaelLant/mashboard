import React from "react";

interface OwnProps<T> {
  children:
    | React.ReactElement<ChildPropTypes<T>>
    | React.ReactElement<ChildPropTypes<T>>[];
  expression: T;
}

interface ChildPropTypes<T> {
  children: React.ReactElement;
  value?: T;
}

const Switch = <T,>(props: OwnProps<T>) => {
  let CASE = null;
  let DEFAULT = null;

  React.Children.forEach(
    props.children,
    (child: React.ReactElement<ChildPropTypes<T>>) => {
      if (React.isValidElement(child)) {
        if (props.expression === child.props.value) {
          CASE = child;
        } else {
          DEFAULT = child;
        }
      }
    }
  );

  return CASE || DEFAULT;
};

Switch.CASE = <T,>(props: ChildPropTypes<T>) => props.children;
Switch.DEFAULT = <T,>(props: ChildPropTypes<T>) => props.children;

export default Switch;
