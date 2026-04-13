#include "example.hpp"

#include <gtest/gtest.h>

TEST(ExampleTest, GreetsName) {
    EXPECT_EQ(vnpt::greet("VNPT"), "Hello, VNPT");
}
